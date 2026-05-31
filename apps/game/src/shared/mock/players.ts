import type { SeatIndex } from '@gbedity/ui';

// Fixed mock roster per the screens spec: Tobi, Ada, Funmi, Kemi; room GBE-4ZK.
// The current player (for player-context screens) is Funmi. Host is Tobi.

export interface MockPlayer {
  readonly id: string;
  readonly name: string;
  readonly seat: SeatIndex;
  readonly joinedAgo: string;
}

export const PLAYERS: readonly MockPlayer[] = [
  { id: 'tobi', name: 'Tobi', seat: 2, joinedAgo: 'joined 18s ago' },
  { id: 'ada', name: 'Ada', seat: 1, joinedAgo: 'joined 14s ago' },
  { id: 'funmi', name: 'Funmi', seat: 3, joinedAgo: 'joined 9s ago' },
  { id: 'kemi', name: 'Kemi', seat: 4, joinedAgo: 'joined 4s ago' },
];

export const HOST_ID = 'tobi';
export const CURRENT_PLAYER_ID = 'funmi';

export interface MockScore {
  readonly name: string;
  readonly seat: SeatIndex;
  readonly score: number;
}

/** Default leaderboard (Word Bomb template from the spec). Ada wins. */
export const LEADERBOARD: readonly MockScore[] = [
  { name: 'Ada', seat: 1, score: 1420 },
  { name: 'Tobi', seat: 2, score: 1180 },
  { name: 'Funmi', seat: 3, score: 940 },
  { name: 'Kemi', seat: 4, score: 720 },
];

/** Cheerful nickname suggestions for the join flow. */
export const NICKNAME_SUGGESTIONS: readonly string[] = [
  'BoldOkra',
  'QuietJollof',
  'SmoothAmala',
  'SwiftEgusi',
  'KeenSuya',
];

/** Mock client-side profanity list (placeholder words). */
export const BANNED_NICKNAMES: readonly string[] = ['badword', 'rude', 'curse', 'slur', 'nope'];
