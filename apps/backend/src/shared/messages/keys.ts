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
} as const;

type Slice = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];
export type MessageKey = Slice[keyof Slice];
