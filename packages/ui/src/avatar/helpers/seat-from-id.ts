import type { SeatIndex } from '../avatar.tsx';

export interface SeatFromId {
  /** Seat colour (1–8), derived deterministically from the id. */
  seat: SeatIndex;
  /** Single uppercase character to show on the fallback avatar. */
  initial: string;
}

// Deterministic fallback identity for a GameAvatar.
//
// When DiceBear can't render, GameAvatar drops back to the seat-coloured initial
// Avatar. We derive both the seat colour and the initial from the id itself so a
// given player always falls back to the same colour + letter, with no bookkeeping
// at the call site.
//
// The hash is a small, stable string fold (djb2-style). It is NOT for security —
// only for spreading ids evenly across the 8 seat colours.
function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    // hash * 33 + charCode, kept in the 32-bit range.
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * Derive a stable seat colour + initial from an id, for the GameAvatar fallback.
 *
 * An empty id yields seat 1 and a neutral '?' so the fallback never renders blank.
 */
export function seatFromId(id: string): SeatFromId {
  const trimmed = id.trim();
  if (trimmed === '') {
    return { seat: 1, initial: '?' };
  }

  // (hash % 8) + 1 → 1..8, the SeatIndex range.
  const seat = ((hashString(trimmed) % 8) + 1) as SeatIndex;
  const initial = trimmed.slice(0, 1).toUpperCase();

  return { seat, initial };
}
