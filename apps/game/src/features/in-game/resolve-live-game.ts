import { backendGameId } from '../../shared/games/config-map.ts';
import { GAMES, type GameCategory } from '../../shared/games/games-manifest.ts';
import { REAL_GAME_IDS } from '../../shared/types/api.ts';

export interface LiveGame {
  readonly backendId: string;
  readonly id: number;
  readonly title: string;
  readonly category: GameCategory;
}

// Resolve a ?live=<backendId> param to the matching catalogue game (id/title/category for the
// shell chrome). Returns undefined when the param is absent or not a real backend game — the
// screen then falls back to mock rendering.
export function resolveLiveGame(liveParam: string | null): LiveGame | undefined {
  if (liveParam === null || !REAL_GAME_IDS.includes(liveParam)) return undefined;
  const game = GAMES.find((g) => backendGameId(g.key) === liveParam);
  if (game === undefined) return undefined;
  return { backendId: liveParam, id: game.id, title: game.title, category: game.category };
}
