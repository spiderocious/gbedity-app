// The client-owned phase machine for solo Investigation. The CLIENT paces the case: open the file,
// work it within the window, accuse, reveal. Named const-POJO (no inline union literals).

export const InvPhase = {
  STARTING: 'starting', // POST /start in flight
  BRIEFING: 'briefing', // the case opener
  INVESTIGATE: 'investigate', // the working desk (timed)
  ACCUSE: 'accuse', // build the accusation
  REVEAL: 'reveal', // the truth + verdict
  FINAL: 'final', // final score / play again
  ERROR: 'error',
} as const;
export type InvPhase = (typeof InvPhase)[keyof typeof InvPhase];
