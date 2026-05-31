import { backendGameId } from '../../shared/games/config-map.ts';
import { GAMES, type GameCategory } from '../../shared/games/games-manifest.ts';
import { RealGameId, REAL_GAME_IDS } from '../../shared/types/api.ts';
import type { ViewPatch } from '../../shared/types/view.ts';

export interface LiveGame {
  readonly backendId: string;
  readonly id: number;
  readonly title: string;
  readonly category: GameCategory;
}

function liveGameFromBackendId(backendId: string): LiveGame | undefined {
  const game = GAMES.find((g) => backendGameId(g.key) === backendId);
  if (game === undefined) return undefined;
  return { backendId, id: game.id, title: game.title, category: game.category };
}

// In-game is LIVE by default. `?mock=<catalogueId>` opts a screen into the static preview
// content registry instead (used by /preview-screens and the 13 non-backed games).
export function resolveMockGame(mockParam: string | null): number | undefined {
  if (mockParam === null) return undefined;
  const id = Number.parseInt(mockParam, 10);
  return Number.isNaN(id) ? undefined : id;
}

// Identify which of the 5 backed games a live patch belongs to, from its shape. The backend's
// patches don't carry a gameId, but each game's fields are distinct (see integration-plan §8),
// so the shape is a reliable discriminant for picking the right renderer + chrome.
export function detectLiveGame(patch: ViewPatch | null): LiveGame | undefined {
  if (patch === null) return undefined;
  if (patch.scenario !== undefined) return liveGameFromBackendId(RealGameId.PLEAD_YOUR_CASE);
  if (patch.defences !== undefined) return liveGameFromBackendId(RealGameId.HOT_TAKE_COURT);
  if (patch.holderId !== undefined || patch.used !== undefined) return liveGameFromBackendId(RealGameId.WORD_BOMB);
  if (patch.options !== undefined || patch.qIndex !== undefined) return liveGameFromBackendId(RealGameId.QUIZZES);
  if (patch.letter !== undefined || patch.ranked !== undefined) return liveGameFromBackendId(RealGameId.WORDSHOT);
  return undefined;
}

// `?live=<backendId>` is still honoured as a chrome hint (host/display start emit it) so the
// title/category show before the first patch arrives. Optional — detection covers it once live.
export function resolveLiveHint(liveParam: string | null): LiveGame | undefined {
  if (liveParam === null || !REAL_GAME_IDS.includes(liveParam)) return undefined;
  return liveGameFromBackendId(liveParam);
}
