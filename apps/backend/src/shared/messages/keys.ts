// Central message-key catalog, sliced per feature. Never hardcode human-readable response
// strings in handlers/services — reference a key, resolve through the registry.

export const MESSAGE_KEYS = {
  common: {
    OK: 'common.ok',
    NOT_FOUND: 'common.not_found',
    VALIDATION_FAILED: 'common.validation_failed',
    INTERNAL_ERROR: 'common.internal_error',
    RATE_LIMITED: 'common.rate_limited',
  },
  rooms: {
    CREATED: 'rooms.created',
    NOT_FOUND: 'rooms.not_found',
    FULL: 'rooms.full',
    CLOSED: 'rooms.closed',
    JOINED: 'rooms.joined',
    NICKNAME_TAKEN: 'rooms.nickname_taken',
    NICKNAME_RESERVED: 'rooms.nickname_reserved',
    NOT_IN_LOBBY: 'rooms.not_in_lobby',
  },
  games: {
    STARTED: 'games.started',
    NOT_FOUND: 'games.not_found',
    NOT_HOST: 'games.not_host',
    NOT_ENOUGH_PLAYERS: 'games.not_enough_players',
    ALREADY_RUNNING: 'games.already_running',
  },
  solo: {
    STARTED: 'solo.started',
    NOT_SUPPORTED: 'solo.not_supported',
    NOT_FOUND: 'solo.not_found',
  },
  soloMl: {
    OVER: 'solo_ml.over',
    ALREADY_ANSWERED: 'solo_ml.already_answered',
  },
  soloWs: {
    OVER: 'solo_ws.over',
    ALREADY_ANSWERED: 'solo_ws.already_answered',
  },
  soloInv: {
    NO_CASE: 'solo_inv.no_case',
    ALREADY_ACCUSED: 'solo_inv.already_accused',
  },
  soloWwtbam: {
    OVER: 'solo_wwtbam.over',
    ALREADY_ANSWERED: 'solo_wwtbam.already_answered',
    LIFELINE_USED: 'solo_wwtbam.lifeline_used',
    NO_LIFELINE: 'solo_wwtbam.no_lifeline',
  },
  admin: {
    SEEDED: 'admin.seeded',
    SEED_DISABLED: 'admin.seed_disabled',
    ALREADY_SEEDED: 'admin.already_seeded',
    INVALID_CREDENTIALS: 'admin.invalid_credentials',
    TOKEN_INVALID: 'admin.token_invalid',
    SESSION_REVOKED: 'admin.session_revoked',
    UNAUTHORIZED: 'admin.unauthorized',
    SAVED: 'admin.saved',
    DELETED: 'admin.deleted',
    NOT_FOUND: 'admin.not_found',
  },
  auth: {
    INVALID_CREDENTIALS: 'auth.invalid_credentials',
    EMAIL_TAKEN: 'auth.email_taken',
    TOKEN_INVALID: 'auth.token_invalid',
    SESSION_REVOKED: 'auth.session_revoked',
    REGISTERED: 'auth.registered',
  },
  catalogue: {
    CREATED: 'catalogue.created',
    NOT_FOUND: 'catalogue.not_found',
    ALREADY_EXISTS: 'catalogue.already_exists',
    UPDATED: 'catalogue.updated',
    ACTIVATED: 'catalogue.activated',
    DEACTIVATED: 'catalogue.deactivated',
    DELETED: 'catalogue.deleted',
    INVALID_GAME: 'catalogue.invalid_game',
  },
} as const;

// Union of every leaf value across all slices. Mapping over each slice individually (then
// indexing) avoids the union-of-objects collapsing to an intersection of keys.
type Catalog = typeof MESSAGE_KEYS;
export type MessageKey = {
  [S in keyof Catalog]: Catalog[S][keyof Catalog[S]];
}[keyof Catalog];
