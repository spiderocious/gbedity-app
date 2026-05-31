// Deterministic letter + category selection for Wordshot/Word Bomb, distilled from wordmaster's
// game-question + category-randomizer services. Seeded (no Math.random) so rounds reproduce on
// recovery/replay — the plugin receives a precomputed plan in its content.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const COMMON = 'abcdefghilmnoprstuw'.split(''); // drop the hard letters for common_only
const RARE_OK = ALPHABET; // includes q/x/z

export const LetterDifficulty = {
  COMMON_ONLY: 'common_only',
  INCLUDES_QXZ: 'includes_qxz',
  MIXED: 'mixed',
} as const;
export type LetterDifficulty = (typeof LetterDifficulty)[keyof typeof LetterDifficulty];

// A tiny seeded PRNG (mulberry32) — deterministic from a string seed.
const makeRng = (seed: string): (() => number) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pool = (difficulty: LetterDifficulty): string[] =>
  difficulty === LetterDifficulty.COMMON_ONLY ? COMMON : RARE_OK;

// Generate `count` letters with a min-distance no-repeat window (wordmaster generateLetters).
export const generateLetters = (
  seed: string,
  count: number,
  difficulty: LetterDifficulty = LetterDifficulty.MIXED,
  minDistance = 2,
): string[] => {
  const rng = makeRng(`${seed}:letters`);
  const source = pool(difficulty);
  const result: string[] = [];
  const recent: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const available = source.filter((l) => !recent.includes(l));
    const choices = available.length > 0 ? available : source;
    const letter = choices[Math.floor(rng() * choices.length)] ?? source[0]!;
    result.push(letter);
    recent.push(letter);
    if (recent.length > minDistance) recent.shift();
  }
  return result;
};

// Pick a category per letter from the enabled set, non-successive (wordmaster category-randomizer).
export const assignCategories = (seed: string, letters: string[], enabled: string[]): string[] => {
  const rng = makeRng(`${seed}:cats`);
  const recent: string[] = [];
  const minDistance = Math.min(2, Math.max(1, Math.floor(enabled.length / 2)));
  return letters.map(() => {
    const available = enabled.filter((c) => !recent.includes(c));
    const choices = available.length > 0 ? available : enabled;
    const cat = choices[Math.floor(rng() * choices.length)] ?? enabled[0]!;
    recent.push(cat);
    if (recent.length > minDistance) recent.shift();
    return cat;
  });
};
