// The operational word/definition collections the live games draw from. `rank` (1–5, 5 = most
// common → picked most often) and `difficulty` (1–3) drive selection; `source` records where the
// row was promoted from. Distinct from the reference collections (dictionary/allwords/words), which
// are read-only sources the admin promotes from.

export const WordSource = {
  SEED: 'seed',
  DICTIONARY: 'dictionary',
  ALLWORDS: 'allwords',
  WORDS: 'words',
  MANUAL: 'manual',
} as const;
export type WordSource = (typeof WordSource)[keyof typeof WordSource];

// A reference collection an admin can browse + promote from.
export const ReferenceSource = {
  DICTIONARY: 'dictionary',
  ALLWORDS: 'allwords',
  WORDS: 'words',
} as const;
export type ReferenceSource = (typeof ReferenceSource)[keyof typeof ReferenceSource];

export interface GameWordDoc {
  id: string; // gw_<ULID>
  word: string; // unique, lowercase a–z
  startsWith: string;
  length: number;
  rank: number; // 1–5
  difficulty: number; // 1–3
  source: WordSource;
  createdAt: number;
  updatedAt: number;
}

export interface GameDefinitionDoc {
  id: string; // gd_<ULID>
  word: string; // unique, lowercase a–z
  definition: string;
  length: number;
  rank: number; // 1–5
  difficulty: number; // 1–3
  source: WordSource;
  createdAt: number;
  updatedAt: number;
}

export const RANK_MIN = 1;
export const RANK_MAX = 5;
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 3;
