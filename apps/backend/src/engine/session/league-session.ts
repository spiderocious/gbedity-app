import type { OutputSink } from '../output-sink';
import type { PlayerRef, RatingFilter, RoundScore } from '../types';
import { GameRuntime } from '../game-runtime';
import { Leaderboard } from '../scoring/leaderboard';

import {
  AggregateMode,
  type AggregateRow,
  type LeagueConfig,
} from './session.types';

// League session (game-engine.md §4, PRD §7.3). Plays a queue of games sequentially. Each game is
// converted to percent-of-max so every game contributes on the same 0..100% scale regardless of
// its raw point ceiling; the aggregate applies the per-game weight. The plugins are unaware.

export interface LeagueSessionOptions {
  roomCode: string;
  players: PlayerRef[];
  league: LeagueConfig;
  ratingFilter?: RatingFilter;
  sink?: OutputSink;
}

interface CompletedGame {
  weight: number;
  percentByPlayer: Map<string, number>; // playerId → 0..1
}

export class LeagueSession {
  private readonly opts: LeagueSessionOptions;
  private index = 0;
  private current: { runtime: GameRuntime; board: Leaderboard } | null = null;
  private readonly completed: CompletedGame[] = [];

  constructor(opts: LeagueSessionOptions) {
    this.opts = opts;
  }

  // Start the next queued game. Returns false when the queue is exhausted.
  startNext(): boolean {
    const entry = this.opts.league.entries[this.index];
    if (entry === undefined) return false;

    const board = new Leaderboard();
    const runtime = new GameRuntime({
      roomCode: this.opts.roomCode,
      plugin: entry.plugin,
      players: this.opts.players,
      ...(this.opts.ratingFilter !== undefined && { ratingFilter: this.opts.ratingFilter }),
      ...(this.opts.sink !== undefined && { sink: this.opts.sink }),
      onRoundEnded: (score: RoundScore): void => board.apply(score),
      onGameEnded: (): void => this.finishCurrent(),
    });
    this.current = { runtime, board };
    runtime.start(entry.config, entry.content);
    return true;
  }

  private finishCurrent(): void {
    const entry = this.opts.league.entries[this.index];
    if (this.current && entry) {
      const percentByPlayer = new Map<string, number>();
      for (const p of this.opts.players) {
        percentByPlayer.set(p.id, this.current.board.percentFor(p.id));
      }
      this.completed.push({ weight: entry.weight, percentByPlayer });
    }
    this.index += 1;
    this.current = null;
  }

  // Cross-game aggregate per the configured mode (PRD §7.3). Percentages are weighted then folded.
  aggregate(): AggregateRow[] {
    const byPlayer = new Map<string, number[]>(); // playerId → weighted percent per game
    for (const game of this.completed) {
      for (const [playerId, pct] of game.percentByPlayer) {
        const list = byPlayer.get(playerId) ?? [];
        list.push(pct * game.weight * 100); // express as percentage points
        byPlayer.set(playerId, list);
      }
    }

    const rows: AggregateRow[] = [];
    for (const [playerId, scores] of byPlayer) {
      rows.push({ playerId, score: this.fold(scores) });
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  private fold(scores: number[]): number {
    switch (this.opts.league.aggregate) {
      case AggregateMode.SUM:
        return scores.reduce((a, b) => a + b, 0);
      case AggregateMode.AVERAGE:
        return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
      case AggregateMode.TOP_3:
        return [...scores]
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((a, b) => a + b, 0);
      default: {
        const _never: never = this.opts.league.aggregate;
        return _never;
      }
    }
  }

  currentRuntime(): GameRuntime | null {
    return this.current?.runtime ?? null;
  }

  isComplete(): boolean {
    return this.index >= this.opts.league.entries.length;
  }

  async dispose(): Promise<void> {
    if (this.current) await this.current.runtime.dispose();
  }
}
