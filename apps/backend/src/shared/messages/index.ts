import { MESSAGE_KEYS, type MessageKey } from './keys';

// Resolve a message key to its human-readable string. English only for v1 (Pidgin deferred).
const catalog: Record<MessageKey, string> = {
  [MESSAGE_KEYS.common.OK]: 'OK.',
  [MESSAGE_KEYS.common.NOT_FOUND]: 'Not found.',
  [MESSAGE_KEYS.common.VALIDATION_FAILED]: 'Some fields need another look.',
  [MESSAGE_KEYS.common.INTERNAL_ERROR]: 'Something went wrong on our end.',
  [MESSAGE_KEYS.common.RATE_LIMITED]: 'Slow down a moment.',

  [MESSAGE_KEYS.rooms.CREATED]: 'Room ready.',
  [MESSAGE_KEYS.rooms.NOT_FOUND]: "Couldn't find that room.",
  [MESSAGE_KEYS.rooms.FULL]: 'That room is full.',
  [MESSAGE_KEYS.rooms.CLOSED]: 'That room has closed.',
  [MESSAGE_KEYS.rooms.JOINED]: "You're in.",
  [MESSAGE_KEYS.rooms.NICKNAME_TAKEN]: 'That nickname is taken — pick another.',
};

export const messages = {
  get: (key: MessageKey): string => catalog[key] ?? key,
};

export { MESSAGE_KEYS, type MessageKey };
