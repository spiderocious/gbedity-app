import { now } from '@shared/time';

import type { PlayerRef, AnyGamePlugin, RatingFilter, RoundScore } from '../types';
import type { OutputSink } from '../output-sink';
import { GameRuntime } from '../game-runtime';
import { Leaderboard, type LeaderboardRow } from '../scoring/leaderboard';
import { persistence } from '../services/persistence-hook';
import type { GameSnapshot } from '../snapshot';

// Single-game session (game-engine.md §1). One plugin, one runtime, one raw leaderboard. No
// normalization — one game, one scale (§4). The runtime is unaware league mode exists.

export interface SingleSessionOptions {
  roomCode: string;
  plugin: AnyGamePlugin;
  players: PlayerRef[];
  config: unknown;
  content: unknown;
  ratingFilter?: RatingFilter;
  sink?: OutputSink;
  // Fired when the game ends — lets the room flip back to lobby (PRD §4). Session stays
  // engine-only; lifecycle reaction lives in the caller.
  onEnded?: () => void;
}

// Options for recovering a session from a snapshot on boot. The runtime keeps the snapshot's
// identity (instanceId) and seed so the rebuilt PRNG/timeline matches the original (§6).
export interface RecoverSessionOptions {
  plugin: AnyGamePlugin;
  snapshot: GameSnapshot;
  ratingFilter?: RatingFilter;
  sink?: OutputSink;
  onEnded?: () => void;
}

interface BuildArgs {
  roomCode: string;
  plugin: AnyGamePlugin;
  players: PlayerRef[];
  seed?: string;
  instanceId?: string;
  ratingFilter?: RatingFilter;
  sink?: OutputSink;
  onEnded?: () => void;
}

export class SingleSession {
  readonly runtime: GameRuntime;
  private readonly board = new Leaderboard();
  private ended = false;
  private readonly startedAt = now();

  // Constructing the runtime inside the constructor lets its callbacks close over `this` directly
  // (no forward-declared `let`). Shared by start() and recover() via the static factories.
  private constructor(args: BuildArgs) {
    this.runtime = new GameRuntime({
      roomCode: args.roomCode,
      plugin: args.plugin,
      players: args.players,
      ...(args.seed !== undefined && { seed: args.seed }),
      ...(args.instanceId !== undefined && { instanceId: args.instanceId }),
      ...(args.ratingFilter !== undefined && { ratingFilter: args.ratingFilter }),
      ...(args.sink !== undefined && { sink: args.sink }),
      onRoundEnded: (score: RoundScore): void => this.board.apply(score),
      onGameEnded: (): void => {
        this.ended = true;
        this.recordPlay();
        args.onEnded?.();
      },
    });
  }

  // Persist a game-play summary on game end (PRD §9). Fire-and-forget via the injected hook.
  private recordPlay(): void {
    const id = this.runtime.playIdentity();
    persistence().recordPlay({
      id: id.id,
      roomCode: id.roomCode,
      gameId: id.gameId,
      players: id.players.map((p) => ({ id: p.id, nickname: p.nickname })),
      finalBoard: this.board.rows().map((r) => ({ playerId: r.playerId, points: r.points })),
      startedAt: this.startedAt,
      endedAt: now(),
    });
  }

  // Start a brand-new game.
  static start(opts: SingleSessionOptions): SingleSession {
    const session = new SingleSession({
      roomCode: opts.roomCode,
      plugin: opts.plugin,
      players: opts.players,
      ...(opts.ratingFilter !== undefined && { ratingFilter: opts.ratingFilter }),
      ...(opts.sink !== undefined && { sink: opts.sink }),
      ...(opts.onEnded !== undefined && { onEnded: opts.onEnded }),
    });
    session.runtime.start(opts.config, opts.content);
    return session;
  }

  // Rebuild a session from a snapshot on boot, then rehydrate the runtime (re-arm timers, fire
  // missed deadlines, re-broadcast). The snapshot is self-sufficient (carries seed + players).
  static recover(opts: RecoverSessionOptions): SingleSession {
    const session = new SingleSession({
      roomCode: opts.snapshot.roomCode,
      plugin: opts.plugin,
      players: opts.snapshot.players,
      seed: opts.snapshot.seed,
      instanceId: opts.snapshot.instanceId,
      ...(opts.ratingFilter !== undefined && { ratingFilter: opts.ratingFilter }),
      ...(opts.sink !== undefined && { sink: opts.sink }),
      ...(opts.onEnded !== undefined && { onEnded: opts.onEnded }),
    });
    session.runtime.rehydrate(opts.snapshot);
    return session;
  }

  leaderboard(): LeaderboardRow[] {
    return this.board.rows();
  }

  isEnded(): boolean {
    return this.ended;
  }

  async dispose(): Promise<void> {
    await this.runtime.dispose();
  }
}
