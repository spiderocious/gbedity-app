import type { AnyGamePlugin } from '../types';

// Aggregate scoring modes for league mode (PRD §7.3). Variant strings as named constants.
export const AggregateMode = {
  SUM: 'sum',
  AVERAGE: 'average',
  TOP_3: 'top_3',
} as const;
export type AggregateMode = (typeof AggregateMode)[keyof typeof AggregateMode];

// One entry in a league queue: a game + its config/content + a weight multiplier (1×/2×/3×).
export interface LeagueEntry {
  plugin: AnyGamePlugin;
  config: unknown;
  content: unknown;
  weight: number; // 1 | 2 | 3 (PRD §7.3 game weight)
}

export interface LeagueConfig {
  entries: LeagueEntry[];
  aggregate: AggregateMode;
}

// A per-player aggregate row across a league (percent-based, so games are comparable — §4).
export interface AggregateRow {
  playerId: string;
  score: number; // aggregated percentage points
}
