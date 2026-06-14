// Shared masking for Missing Letters — single source for both the socket content resolver
// (multiplayer) and the client-driven solo endpoints. Given a word, deterministically choose which
// interior positions to HIDE (never the first letter, for solvability) and return the REVEALED
// indices. Deterministic on (word, hidden, seed) so a replay/recovery reproduces the same mask.

// Revealed indices = all positions minus the hidden ones.
export const maskPositions = (word: string, hidden: number, seed: string): number[] => {
  const candidates = word
    .split('')
    .map((_, i) => i)
    .filter((i) => i > 0); // never hide the first letter
  // Simple seeded shuffle so the choice is stable for a given seed.
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const shuffled = [...candidates].sort((a, b) => ((h + a) % 7) - ((h + b) % 7));
  const toHide = new Set(shuffled.slice(0, Math.min(hidden, candidates.length)));
  return word
    .split('')
    .map((_, i) => i)
    .filter((i) => !toHide.has(i));
};

// Render a word against its revealed indices as a space-separated mask: "b _ n _ n a".
export const maskedString = (answer: string, revealed: readonly number[]): string =>
  answer
    .split('')
    .map((ch, i) => (revealed.includes(i) ? ch : '_'))
    .join(' ');
