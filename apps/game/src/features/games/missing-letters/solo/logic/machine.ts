// The client-owned phase machine for solo Missing Letters. Unlike the multiplayer engine, the CLIENT
// drives these transitions: it runs its own countdown, fetches each round, times it, and advances
// when the player continues. Named const-POJO (no inline union literals).

export const MlPhase = {
  INTRO: 'intro', // client-only opener; waiting for the player to start
  STARTING: 'starting', // POST /start in flight
  COUNTDOWN: 'countdown', // client 3·2·1 beat before a round
  PLAYING: 'playing', // round live: masked word shown, timer running, guess accepted
  REVEAL: 'reveal', // per-round result (correct/wrong + answer + points)
  FINAL: 'final', // end-of-game celebration (final score)
  ERROR: 'error', // a call failed; show a retry affordance
} as const;
export type MlPhase = (typeof MlPhase)[keyof typeof MlPhase];

// Tuning for the client-run countdown beat before each round (cosmetic; backend doesn't time solo).
export const COUNTDOWN_SECONDS = 3;
