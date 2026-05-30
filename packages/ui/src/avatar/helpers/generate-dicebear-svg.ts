import { createAvatar } from '@dicebear/core';
import { adventurerNeutral } from '@dicebear/collection';

// Generate a DiceBear `adventurer-neutral` avatar as an inline SVG data URI.
//
// Style reference: https://www.dicebear.com/styles/adventurer-neutral/
// Generation is synchronous and fully client-side — no network request — so the
// component stays pure, offline-safe, and cheap on the 2G/3G connections the
// product targets.
//
// This helper NEVER throws: any failure (bad seed, library error) returns null so
// GameAvatar can fall back to the seat-coloured initial Avatar.

/** Brand Canvas Mint, sans the leading '#' that DiceBear's backgroundColor expects. */
const BACKGROUND_COLOR = 'c8e8da';

/**
 * Build an `adventurer-neutral` SVG data URI from a seed.
 *
 * @returns a `data:image/svg+xml` URI, or null if the seed is empty or generation fails.
 */
export function generateDicebearSvg(seed: string): string | null {
  if (seed.trim() === '') {
    return null;
  }

  try {
    const svg = createAvatar(adventurerNeutral, {
      seed,
      backgroundColor: [BACKGROUND_COLOR],
      // Full circle — matches the avatar's full-pill geometry.
      radius: 50,
    }).toString();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    // Swallow and signal fallback. The caller renders the initial-based Avatar.
    return null;
  }
}
