// Stable string error codes. Clients switch on these — never on HTTP status or message text.
// New codes are added here; never inline a literal anywhere else.

export const ERROR_CODES = {
  // Request issues
  VALIDATION_ERROR: 'validation_error',
  NOT_FOUND: 'not_found',
  BAD_REQUEST: 'bad_request',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  FORBIDDEN: 'forbidden',

  // Auth (admin + host)
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_INVALID: 'token_invalid',
  TOKEN_EXPIRED: 'token_expired',
  SESSION_REVOKED: 'session_revoked',
  UNAUTHORIZED: 'unauthorized',

  // Rooms / sessions (PRD §4)
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  ROOM_CLOSED: 'room_closed',
  NICKNAME_TAKEN: 'nickname_taken',
  NOT_IN_LOBBY: 'not_in_lobby',
  GAME_NOT_FOUND: 'game_not_found',
  NOT_HOST: 'not_host',
  NOT_ENOUGH_PLAYERS: 'not_enough_players',
  GAME_ALREADY_RUNNING: 'game_already_running',

  // Catalogue (admin-curated public game list)
  CATALOGUE_ENTRY_EXISTS: 'catalogue_entry_exists',

  // Server
  INTERNAL_ERROR: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
