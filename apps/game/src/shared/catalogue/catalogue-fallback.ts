import { GAMES, type LandingGame } from '../games/games-manifest.ts';
import { GAME_ICON } from '../games/game-icons.ts';
import type { CatalogueGame } from './catalogue.types.ts';

// Static fallback for the catalogue store: the bundled games-manifest mapped into the live
// CatalogueGame shape. Used as React Query `placeholderData` so the showcase/picker render
// instantly on cold load and degrade gracefully if /catalogue is unreachable. The live query
// always wins once it resolves — this is fallback only (never the primary source).
//
// The static LandingGame lacks a few server fields; we derive them deterministically:
//  - gameId: kebab key → snake engine id (the backend's GameId convention).
//  - estMinutes: parsed from the manifest's `meta` ("2–10 · 8m" → 8).
//  - mode: not on the static manifest → 'simultaneous' as the safe default (display-only; the
//    real value arrives with the live query). players: min/max parsed from `meta`.
//  - iconName: the lucide component's display name from GAME_ICON.

const META_RE = /^(\d+)(?:–(\d+))?\s*·\s*(\d+)m$/;

const parseMeta = (meta: string): { min: number; max: number | null; mins: number } => {
  const m = META_RE.exec(meta);
  if (!m) return { min: 2, max: null, mins: 8 };
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : null;
  const mins = Number(m[3]);
  return { min, max, mins };
};

const iconName = (game: LandingGame): string => {
  const Icon = GAME_ICON[game.key];
  // lucide components expose `displayName`; fall back to a generic glyph name.
  return (Icon as { displayName?: string }).displayName ?? 'Gamepad2';
};

const toCatalogueGame = (game: LandingGame): CatalogueGame => {
  const { min, max, mins } = parseMeta(game.meta);
  return {
    id: game.id,
    gameId: game.key.replace(/-/g, '_'), // kebab → snake (engine GameId)
    key: game.key,
    category: game.category,
    mode: 'simultaneous',
    title: game.title,
    description: game.description,
    estMinutes: mins,
    players: { min, max, recommendedMax: max ?? min + 8 },
    meta: game.meta,
    iconName: iconName(game),
  };
};

export const GAMES_FALLBACK: readonly CatalogueGame[] = GAMES.map(toCatalogueGame);
