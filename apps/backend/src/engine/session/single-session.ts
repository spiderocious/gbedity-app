import type { PlayerRef, AnyGamePlugin, RatingFilter, RoundScore } from '../types';
import type { OutputSink } from '../output-sink';
import { GameRuntime } from '../game-runtime';
import { Leaderboard, type LeaderboardRow } from '../scoring/leaderboard';

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
}

export class SingleSession {
  readonly runtime: GameRuntime;
  private readonly board = new Leaderboard();
  private ended = false;

  constructor(opts: SingleSessionOptions) {
    this.runtime = new GameRuntime({
      roomCode: opts.roomCode,
      plugin: opts.plugin,
      players: opts.players,
      ...(opts.ratingFilter !== undefined && { ratingFilter: opts.ratingFilter }),
      ...(opts.sink !== undefined && { sink: opts.sink }),
      onRoundEnded: (score: RoundScore): void => this.board.apply(score),
      onGameEnded: (): void => {
        this.ended = true;
      },
    });
    this.runtime.start(opts.config, opts.content);
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
