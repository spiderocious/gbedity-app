import type { ViewPatch } from '../../shared/types/view.ts';

// Resolve which backed game a live screen is showing — by backend gameId only. This is renderer
// ROUTING (patch shape → which game's renderer), NOT a catalogue/visibility list: it names the few
// games whose live patches are distinguishable by shape today, each a named constant (no inline
// strings, no RealGameId gate). Display chrome (title/category) is joined separately from the
// catalogue store at the call site — keeping these functions pure + unit-testable.

// Backend gameIds whose live patches the renderers can identify by shape. Extended as more games
// get a live renderer. Named constants, not a hardcoded "which games exist" list.
export const LiveGameId = {
  PLEAD_YOUR_CASE: 'plead_your_case',
  HOT_TAKE_COURT: 'hot_take_court',
  WORD_BOMB: 'word_bomb',
  QUIZZES: 'quizzes',
  WORDSHOT: 'wordshot',
} as const;
export type LiveGameId = (typeof LiveGameId)[keyof typeof LiveGameId];

// In-game is LIVE by default. `?mock=<catalogueId>` opts a screen into the static preview content
// registry instead (used by /preview-screens and games without a live renderer yet).
export function resolveMockGame(mockParam: string | null): number | undefined {
  if (mockParam === null) return undefined;
  const id = Number.parseInt(mockParam, 10);
  return Number.isNaN(id) ? undefined : id;
}

// Identify which backed game a live patch belongs to, from its shape. The backend's patches don't
// carry a gameId, but each game's fields are distinct, so the shape is a reliable discriminant for
// picking the right renderer + chrome. Returns the backend gameId (or undefined).
export function detectLiveGame(patch: ViewPatch | null): string | undefined {
  if (patch === null) return undefined;
  if (patch.scenario !== undefined) return LiveGameId.PLEAD_YOUR_CASE;
  if (patch.defences !== undefined) return LiveGameId.HOT_TAKE_COURT;
  if (patch.holderId !== undefined || patch.used !== undefined) return LiveGameId.WORD_BOMB;
  if (patch.options !== undefined || patch.qIndex !== undefined) return LiveGameId.QUIZZES;
  if (patch.letter !== undefined || patch.ranked !== undefined) return LiveGameId.WORDSHOT;
  return undefined;
}

// `?live=<backendId>` is honoured as a chrome hint (host/display start emit it) so the renderer +
// title resolve before the first patch arrives. Any backend gameId is accepted — the catalogue
// store is the source of truth for whether it's a real game; an unknown id simply has no renderer.
export function resolveLiveHint(liveParam: string | null): string | undefined {
  return liveParam === null || liveParam === '' ? undefined : liveParam;
}
