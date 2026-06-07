import { getGameContent } from './game-content.tsx';
import type { GameKey } from './games-manifest.ts';

// Client config richness — NOT a backend-existence gate. Every game the catalogue store returns is
// real and startable via its own `gameId` (the backend is the per-environment source of truth, so
// the frontend carries no hardcoded "real games" list). This only answers: does THIS client build a
// rich, bespoke configurator for the game yet? Most do; the rest fall back to the default config
// shell. (Replaces the old RealGameId / isRealGame / backendGameId guesswork.)

export function hasCustomConfig(key: GameKey): boolean {
  return getGameContent(key) !== undefined;
}

// Conservative config sent to POST /rooms/:code/start. We deliberately send no config and let the
// engine apply its full defaults, which always starts (the backend 422s when e.g. `rounds` exceeds
// seeded content). Per-game config tuning is layered on later.
export function buildStartConfig(): Record<string, unknown> {
  return {};
}
