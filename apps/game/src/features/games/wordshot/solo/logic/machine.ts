// Client-owned phase machine for solo Wordshot. The CLIENT drives these transitions: it runs its
// own countdown, fetches each round, times it, and advances when the player continues.
// Named const-POJO — no inline union literals.

export const WsPhase = {
  INTRO: 'intro',       // client-only opener; waiting for the player to start
  STARTING: 'starting', // POST /start in flight
  COUNTDOWN: 'countdown', // client 3·2·1 beat before a round
  PLAYING: 'playing',   // round live: letter+category shown, timer running, word input active
  REVEAL: 'reveal',     // per-round result (correct/wrong + points + suggestion)
  FINAL: 'final',       // end-of-game celebration (final score)
  ERROR: 'error',       // a call failed; show a retry affordance
} as const;
export type WsPhase = (typeof WsPhase)[keyof typeof WsPhase];

export const COUNTDOWN_SECONDS = 3;
