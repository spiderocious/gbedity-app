import { ROOM_CODE_LENGTH } from '../is-valid-room-code/index.ts';

// Where the readability dash sits in the display form (GBE-4ZK → after 3 chars).
const DASH_AT = 3;

/** Strip a room code to its raw form: alphanumeric only, uppercased, max 6 chars. */
export function normalizeRoomCode(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, ROOM_CODE_LENGTH);
}

export interface FormatRoomCodeOptions {
  /**
   * Show a trailing hyphen the instant the code hits exactly 3 chars ("GBE" → "GBE-"), so the
   * dash appears on the 3rd keypress rather than the 4th. Off by default — callers driving an
   * input enable it only while typing forward, never on delete, so backspace stays sane.
   */
  readonly trailingDash?: boolean;
}

/**
 * Format a room code for display: the raw code with a hyphen after the 3rd character once
 * there are more than 3 (e.g. "GBE4ZK" → "GBE-4ZK", "GB" → "GB"). Accepts any input —
 * typed char-by-char, a pasted 6-char code, or a pasted 7-char dashed code — by normalizing
 * first, so the dash always lands in the right spot regardless of how the text arrived.
 *
 * With `trailingDash`, a code of exactly 3 chars renders with the dash already appended.
 */
export function formatRoomCode(input: string, options?: FormatRoomCodeOptions): string {
  const raw = normalizeRoomCode(input);
  if (raw.length > DASH_AT) return `${raw.slice(0, DASH_AT)}-${raw.slice(DASH_AT)}`;
  if (raw.length === DASH_AT && options?.trailingDash === true) return `${raw}-`;
  return raw;
}
