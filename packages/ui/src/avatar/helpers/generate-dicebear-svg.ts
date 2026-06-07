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

// Soft brand tints (sans '#', as DiceBear's backgroundColor expects). DiceBear picks one
// deterministically by seed, so each player gets a distinct coloured disc that always
// contrasts the canvas-mint pill the avatar sits on (a single mint bg would vanish into it).
const BACKGROUND_COLORS = [
  'dff5ea', // action-soft (mint-green)
  'ffe5cd', // accent-soft (peach)
  'e0f2fb', // info-soft (sky)
  'ece2f8', // special-soft (lilac)
  'fef3d1', // sun-soft (butter)
  'fbe0dd', // danger-soft (rose)
];

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
      backgroundColor: BACKGROUND_COLORS,
      // Full circle — matches the avatar's full-pill geometry.
      radius: 50,
    }).toString();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    // Swallow and signal fallback. The caller renders the initial-based Avatar.
    return null;
  }
}
