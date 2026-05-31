// Stable error codes from the backend envelope (api-docs.md). Clients switch on `code`,
// never on the human message. Named constants — no inline string unions.
export const ApiErrorCode = {
  VALIDATION_ERROR: 'validation_error',
  NOT_FOUND: 'not_found',
  BAD_REQUEST: 'bad_request',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  FORBIDDEN: 'forbidden',
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_INVALID: 'token_invalid',
  TOKEN_EXPIRED: 'token_expired',
  SESSION_REVOKED: 'session_revoked',
  UNAUTHORIZED: 'unauthorized',
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  ROOM_CLOSED: 'room_closed',
  NICKNAME_TAKEN: 'nickname_taken',
  NOT_IN_LOBBY: 'not_in_lobby',
  GAME_NOT_FOUND: 'game_not_found',
  NOT_HOST: 'not_host',
  NOT_ENOUGH_PLAYERS: 'not_enough_players',
  GAME_ALREADY_RUNNING: 'game_already_running',
  INTERNAL_ERROR: 'internal_error',
  /** Client-side: network failure / server unreachable. */
  NETWORK_ERROR: 'network_error',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type FieldErrors = Record<string, readonly string[]>;

// Carries the stable code so UI maps code → treatment (the §8 edge states).
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(code: string, message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    if (fieldErrors !== undefined) this.fieldErrors = fieldErrors;
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }
}
