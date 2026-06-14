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
};

/** The dedicated client-driven solo route for a backend gameId, or null if it uses the room path. */
export function clientDrivenSoloRoute(gameId: string): string | null {
  return CLIENT_DRIVEN_SOLO[gameId] ?? null;
}
