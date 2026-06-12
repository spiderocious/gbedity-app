import type { ViewPatch } from '@engine/types';

// Shared view() projection helpers so every game surfaces the SAME fields the animated client flow
// consumes — without each plugin re-implementing them. The client flow needs:
//   • board: cumulative [{ playerId, points, roundDelta }] sorted desc → all-players scores + the
//     round-scores screen + the final result.
//   • deadline (epoch-ms) + the active phase's seconds → the countdown ring / timer bar.
// These are PURE (no I/O) so they stay safe inside view() (which runs during recovery too).

export interface BoardEntry {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

// Build the cumulative board from a per-player totals map (+ optional this-round deltas). `?? {}`
// guards a recovered/partial state where the map is absent (view() must never throw).
export const projectBoard = (
  totals: Record<string, number> | undefined,
  roundDeltas: Record<string, number> = {},
): BoardEntry[] =>
  Object.entries(totals ?? {})
    .map(([playerId, points]) => ({ playerId, points, roundDelta: roundDeltas[playerId] ?? 0 }))
    .sort((a, b) => b.points - a.points);

// The timing fields the client flow reads to drive the countdown. `phaseSeconds` is the active
// phase's window (secondsPerRound / secondsPerTurn / secondsPerPhase) — the client splits its
// interstitials by it. Spread into the view base: `...projectTiming(state.deadline, secs)`.
export const projectTiming = (deadline: number, phaseSeconds: number): Partial<ViewPatch> => ({
  deadline,
  phaseSeconds,
});

// Fold this round's deltas into a running totals map (returns a new map — never mutate state).
export const accrue = (
  totals: Record<string, number> | undefined,
  deltas: Record<string, number>,
): Record<string, number> => {
  const next = { ...(totals ?? {}) };
  for (const [id, pts] of Object.entries(deltas)) next[id] = (next[id] ?? 0) + pts;
  return next;
};
