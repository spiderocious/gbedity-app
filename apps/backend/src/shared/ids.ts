import { ulid } from 'ulid';

// Resource-prefixed ULIDs. Opaque to clients — never parsed or split. Always strings.

export const ID_PREFIX = {
  ROOM: 'r_',
  PLAYER: 'pl_',
  GAME_INSTANCE: 'gi_',
  LEAGUE: 'lg_',
  ADMIN: 'a_',
  HOST: 'h_',
  CONTENT: 'c_',
  CATALOGUE: 'cat_',
  GAME_WORD: 'gw_',
  GAME_DEFINITION: 'gd_',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

export const newId = (prefix: IdPrefix): string => `${prefix}${ulid()}`;

// 6-character room code (PRD §4). Excludes ambiguous chars (0/O, 1/I/L) for read-aloud clarity.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export const newRoomCode = (): string => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
};
