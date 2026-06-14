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
  [MESSAGE_KEYS.rooms.NICKNAME_RESERVED]: '“Spectator” is reserved — pick another nickname.',
  [MESSAGE_KEYS.rooms.NOT_IN_LOBBY]: "That room's game is already in progress.",

  [MESSAGE_KEYS.games.STARTED]: "Let's play.",
  [MESSAGE_KEYS.games.NOT_FOUND]: "Couldn't find that game.",
  [MESSAGE_KEYS.games.NOT_HOST]: 'Only the host can start a game.',
  [MESSAGE_KEYS.games.NOT_ENOUGH_PLAYERS]: 'Not enough players for that game yet.',
  [MESSAGE_KEYS.games.ALREADY_RUNNING]: 'A game is already running.',

  [MESSAGE_KEYS.solo.STARTED]: "Let's play.",
  [MESSAGE_KEYS.solo.NOT_SUPPORTED]: "That game can't be played solo — it needs other players.",
  [MESSAGE_KEYS.solo.NOT_FOUND]: "Couldn't find that solo game.",
  [MESSAGE_KEYS.soloMl.OVER]: 'This game is over.',
  [MESSAGE_KEYS.soloMl.ALREADY_ANSWERED]: "You've already answered this round.",
  [MESSAGE_KEYS.soloWs.OVER]: 'This game is over.',
  [MESSAGE_KEYS.soloWs.ALREADY_ANSWERED]: "You've already answered this round.",
  [MESSAGE_KEYS.soloWwtbam.OVER]: 'This game is over.',
  [MESSAGE_KEYS.soloWwtbam.ALREADY_ANSWERED]: "You've already answered this question.",
  [MESSAGE_KEYS.soloWwtbam.LIFELINE_USED]: "You've already used that lifeline.",
  [MESSAGE_KEYS.soloWwtbam.NO_LIFELINE]: "That lifeline isn't available.",

  [MESSAGE_KEYS.admin.SEEDED]: 'Admin created. Save this password — it is shown once.',
  [MESSAGE_KEYS.admin.SEED_DISABLED]: 'Admin seeding is disabled.',
  [MESSAGE_KEYS.admin.ALREADY_SEEDED]: 'An admin already exists.',
  [MESSAGE_KEYS.admin.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [MESSAGE_KEYS.admin.TOKEN_INVALID]: 'Invalid token.',
  [MESSAGE_KEYS.admin.SESSION_REVOKED]: 'Session revoked — sign in again.',
  [MESSAGE_KEYS.admin.UNAUTHORIZED]: 'Admin access required.',
  [MESSAGE_KEYS.admin.SAVED]: 'Saved.',
  [MESSAGE_KEYS.admin.DELETED]: 'Deleted.',
  [MESSAGE_KEYS.admin.NOT_FOUND]: 'Not found.',

  [MESSAGE_KEYS.auth.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [MESSAGE_KEYS.auth.EMAIL_TAKEN]: 'That email is already registered.',
  [MESSAGE_KEYS.auth.TOKEN_INVALID]: 'Invalid token.',
  [MESSAGE_KEYS.auth.SESSION_REVOKED]: 'Session revoked — sign in again.',
  [MESSAGE_KEYS.auth.REGISTERED]: 'Account created.',

  [MESSAGE_KEYS.catalogue.CREATED]: 'Catalogue entry created.',
  [MESSAGE_KEYS.catalogue.NOT_FOUND]: "Couldn't find that catalogue entry.",
  [MESSAGE_KEYS.catalogue.ALREADY_EXISTS]: 'That game is already in the catalogue.',
  [MESSAGE_KEYS.catalogue.UPDATED]: 'Catalogue entry updated.',
  [MESSAGE_KEYS.catalogue.ACTIVATED]: 'Game is now live.',
  [MESSAGE_KEYS.catalogue.DEACTIVATED]: 'Game pulled from the catalogue.',
  [MESSAGE_KEYS.catalogue.DELETED]: 'Catalogue entry removed.',
  [MESSAGE_KEYS.catalogue.INVALID_GAME]: "That game isn't a registered, playable game.",
};

export const messages = {
  get: (key: MessageKey): string => catalog[key] ?? key,
};

export { MESSAGE_KEYS, type MessageKey };
