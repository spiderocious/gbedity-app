import { ROUTES } from '../../shared/constants/routes.ts';

// Per-game solo entry resolver. Some games (Missing Letters first) have their OWN client-driven solo
// slice with a dedicated route that self-starts via REST — these bypass the room-based /solo/start
// flow entirely. Every other game still uses the room path (handled by the caller). Keeping this in
// one place means the launch screens (play-mode, configure) stay generic; a game opts into its own
// surface by adding an entry here.
//
// Returns a client-driven route to navigate to directly, or null → "use the room-based /solo/start".

const CLIENT_DRIVEN_SOLO: Record<string, string> = {
  missing_letters: ROUTES.MISSING_LETTERS_SOLO,
  wordshot: ROUTES.WORDSHOT_SOLO,
  millionaire: ROUTES.WWTBAM_SOLO,
  investigation: ROUTES.INVESTIGATION_SOLO,
};

/** The dedicated client-driven solo route for a backend gameId, or null if it uses the room path. */
export function clientDrivenSoloRoute(gameId: string): string | null {
  return CLIENT_DRIVEN_SOLO[gameId] ?? null;
}

// Client-driven solo slices self-start via REST, so the chosen config can't go through /solo/start —
// it rides in the URL instead. Encoded as a base64url `cfg` query param. A slice reads it on mount
// and hands it to its own /start. Empty config ⇒ no param (the slice uses its defaults).
const CFG_PARAM = 'cfg';

export function withSoloConfig(route: string, config: Record<string, unknown>): string {
  if (Object.keys(config).length === 0) return route;
  const json = JSON.stringify(config);
  const encoded = typeof window === 'undefined' ? '' : window.btoa(unescape(encodeURIComponent(json)));
  return encoded === '' ? route : `${route}?${CFG_PARAM}=${encodeURIComponent(encoded)}`;
}

export function readSoloConfig(search: string): Record<string, unknown> | undefined {
  try {
    const raw = new URLSearchParams(search).get(CFG_PARAM);
    if (!raw) return undefined;
    const json = decodeURIComponent(escape(window.atob(raw)));
    const parsed = JSON.parse(json) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
