import type { RoundScore } from '../types';

// A raw, single-game leaderboard. Accumulates ScoreDeltas; tracks the running max attainable so a
// game can be normalized to percent-of-max for league aggregation (game-engine.md §4).

export interface LeaderboardRow {
  playerId: string;
  points: number;
}

export class Leaderboard {
  private readonly totals = new Map<string, number>();
  private maxTotal = 0;

  apply(score: RoundScore): void {
    for (const delta of score.deltas) {
      this.totals.set(delta.playerId, (this.totals.get(delta.playerId) ?? 0) + delta.points);
    }
    this.maxTotal += score.maxPoints;
  }

  rows(): LeaderboardRow[] {
    return [...this.totals.entries()]
      .map(([playerId, points]) => ({ playerId, points }))
      .sort((a, b) => b.points - a.points);
  }

  pointsFor(playerId: string): number {
    return this.totals.get(playerId) ?? 0;
  }

  // The maximum a single player could have earned across all scored rounds so far.
  max(): number {
    return this.maxTotal;
  }

  // Percent-of-max for a player (0..1). 0 when nothing scored yet (avoids divide-by-zero).
  percentFor(playerId: string): number {
    return this.maxTotal === 0 ? 0 : this.pointsFor(playerId) / this.maxTotal;
  }
}
