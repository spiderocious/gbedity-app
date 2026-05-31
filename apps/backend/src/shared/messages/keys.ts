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
  },
  games: {
    STARTED: 'games.started',
    NOT_FOUND: 'games.not_found',
    NOT_HOST: 'games.not_host',
    NOT_ENOUGH_PLAYERS: 'games.not_enough_players',
    ALREADY_RUNNING: 'games.already_running',
    UNAVAILABLE: 'games.unavailable',
  },
} as const;

// Union of every leaf value across all slices. Mapping over each slice individually (then
// indexing) avoids the union-of-objects collapsing to an intersection of keys.
type Catalog = typeof MESSAGE_KEYS;
export type MessageKey = {
  [S in keyof Catalog]: Catalog[S][keyof Catalog[S]];
}[keyof Catalog];
