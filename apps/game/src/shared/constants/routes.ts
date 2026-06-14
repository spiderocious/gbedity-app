// Single source of truth for all route paths. Never inline path strings in components.
// Three device contexts: host (/host/*), player (/join, /lobby, /p/*), display (/d/*).
//
// :code and :gameId are mocked everywhere (room GBE-4ZK), but the params stay in the paths
// so wiring real rooms later is a drop-in.

const ROOM = 'GBE-4ZK';

export const ROUTES = {
  LANDING: '/',
  PREVIEW: '/preview',

  // Game-first entry: clicking a game on the landing page lands here to choose how to play
  // (solo "Play Now" · multiplayer create/join). :gameId is the PRD numeric id (catalogue routing).
  PLAY_MODE: '/play/:gameId',

  // Player join flow
  JOIN: '/join',
  // Deep-link the backend hands out as join_url (QR target): /join/:code pre-fills the code.
  JOIN_WITH_CODE: '/join/:code',
  JOIN_NICKNAME: '/join/nickname',
  JOIN_QR: '/join/qr',

  // Player in-room
  PLAYER_LOBBY: '/lobby/:code',
  PLAYER_GAME: '/p/:code/game',
  PLAYER_RESULT: '/p/:code/result',

  // Host flow
  HOST_NEW: '/host/new',
  HOST_DISPLAY: '/host/display',
  HOST_CATALOGUE: '/host/catalogue',
  HOST_CONFIGURE: '/host/configure/:gameId',
  HOST_LEAGUE_NEW: '/host/league/new',
  HOST_LOBBY: '/host/room/:code',
  HOST_GAME: '/host/room/:code/game',
  HOST_RESULT: '/host/room/:code/result',
  HOST_ROUND_DETAIL: '/host/room/:code/round/:n',

  // Display (shared screen). The backend's display_url is /display/:code — the canonical
  // entry; it routes to the display lobby/game depending on room phase.
  DISPLAY: '/display/:code',
  DISPLAY_LOBBY: '/host/room/:code/display',
  DISPLAY_GAME: '/d/:code/game',
  DISPLAY_RESULT: '/d/:code/result',
  DISPLAY_LEAGUE_RESULT: '/d/:code/league-result',

  // Edge-state gallery (dev) — every API-drift state in one place
  EDGE_STATES: '/edge-states',

  // Dev jump page — index of every screen with direct links
  PREVIEW_SCREENS: '/preview-screens',

  // Per-game bare-UI design surface (kinetic preview): every screen of the Missing Letters slice,
  // no logic. Going forward each game slice gets one of these.
  MISSING_LETTERS_PREVIEW: '/preview-ui',

  // Client-driven solo Missing Letters — its own self-contained slice (no socket). The screen
  // self-manages: it calls /solo/missing-letters/start on intro, so no :soloId is needed up front.
  MISSING_LETTERS_SOLO: '/games/missing-letters/solo',

  // Wordshot bare-UI design surface (kinetic preview).
  WORDSHOT_PREVIEW: '/wordshot-preview',

  // Client-driven solo Wordshot — self-contained slice (no socket).
  WORDSHOT_SOLO: '/games/wordshot/solo',

  // WWTBAM bare-UI design surface (kinetic preview): every screen of the WWTBAM slice, no logic.
  WWTBAM_PREVIEW: '/wwtbam-preview',

  // Client-driven solo WWTBAM — self-contained slice (no socket).
  WWTBAM_SOLO: '/games/millionaire/solo',

  // Investigation bare-UI design surface (kinetic preview) — preview-first redesign.
  INVESTIGATION_PREVIEW: '/investigation-preview',

  // Client-driven solo Investigation — self-contained slice (no socket). Self-starts via REST.
  INVESTIGATION_SOLO: '/games/investigation/solo',
} as const;

export type RouteKey = keyof typeof ROUTES;

/** Fill a path's params with mock values for navigation in this UI-only build. */
export function mockPath(path: string, gameId?: string): string {
  return path.replace(':code', ROOM).replace(':gameId', gameId ?? '6').replace(':n', '1');
}

/** Fill a path with real params (live flow). */
export function pathWith(
  path: string,
  params: { code?: string; gameId?: string; n?: string },
): string {
  let out = path;
  if (params.code !== undefined) out = out.replace(':code', params.code);
  if (params.gameId !== undefined) out = out.replace(':gameId', params.gameId);
  if (params.n !== undefined) out = out.replace(':n', params.n);
  return out;
}

export const MOCK_ROOM_CODE = ROOM;

/** Absolute join URL for a room's QR — derived from the current origin, not hardcoded, so it
 *  works off-localhost (tunnels, LAN, deploy). Falls back to a relative path under SSR. */
export function joinUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${pathWith(ROUTES.JOIN_WITH_CODE, { code })}`;
}
