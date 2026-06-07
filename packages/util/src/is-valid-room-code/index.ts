// A room code is exactly 6 alphanumeric characters (e.g. "4DKBGH"). Case-insensitive: the
// backend issues uppercase, but a player may type lowercase. The display form "GBE-4ZK" carries
// a dash purely for readability — strip it before validating the raw code.
const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

/** Length of a valid room code (excluding the display dash). */
export const ROOM_CODE_LENGTH = 6;

/**
 * True when `code` is a syntactically valid room code: exactly 6 alphanumeric characters.
 *
 * Does not check whether the room exists — that's a server lookup.
 */
export function isValidRoomCode(code: unknown): boolean {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}
