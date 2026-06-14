// Client-owned phase machine for solo WWTBAM. The CLIENT drives every transition: it fetches each
// question, runs its own countdown, times the player, and advances on Continue. Named as-const POJO
// — no inline union literals.

export const WwtbamPhase = {
  INTRO: 'intro',       // opening slide; waiting for the player to tap Start
  STARTING: 'starting', // POST /start in flight
  COUNTDOWN: 'countdown', // 3·2·1 beat before each question
  PLAYING: 'playing',   // question live: prompt shown, timer ticking, options clickable
  REVEAL: 'reveal',     // per-question result (correct/wrong + answer highlighted + banked amount)
  FINAL: 'final',       // end-of-game celebration (total banked + emoji)
  ERROR: 'error',       // a call failed; show a retry affordance
} as const;
export type WwtbamPhase = (typeof WwtbamPhase)[keyof typeof WwtbamPhase];

export const COUNTDOWN_SECONDS = 3;
