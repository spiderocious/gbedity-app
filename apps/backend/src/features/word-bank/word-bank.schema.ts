import { z } from 'zod';

import { RANK_MIN, RANK_MAX, DIFFICULTY_MIN, DIFFICULTY_MAX, ReferenceSource } from './word-bank.types';

// Validation for the word-bank admin surface — promotion bodies + rank/difficulty edits.

const rank = z.number().int().min(RANK_MIN).max(RANK_MAX);
const difficulty = z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX);
const word = z.string().min(2).max(40).regex(/^[a-zA-Z]+$/, 'Letters only.');

export const referenceSourceSchema = z.nativeEnum(ReferenceSource);

// Promote words into game_words. Per-item rank/difficulty optional → service applies defaults.
export const promoteWordsSchema = z.object({
  source: z.nativeEnum(ReferenceSource).optional(),
  defaultRank: rank.optional(),
  defaultDifficulty: difficulty.optional(),
  items: z
    .array(
      z.object({
        word,
        rank: rank.optional(),
        difficulty: difficulty.optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type PromoteWordsInput = z.infer<typeof promoteWordsSchema>;

// Promote into game_definitions. A definition may be supplied; otherwise the service pulls it from
// the dictionary by word.
export const promoteDefinitionsSchema = z.object({
  source: z.nativeEnum(ReferenceSource).optional(),
  defaultRank: rank.optional(),
  defaultDifficulty: difficulty.optional(),
  items: z
    .array(
      z.object({
        word,
        definition: z.string().min(1).max(2000).optional(),
        rank: rank.optional(),
        difficulty: difficulty.optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type PromoteDefinitionsInput = z.infer<typeof promoteDefinitionsSchema>;

export const updateWordSchema = z
  .object({ rank: rank.optional(), difficulty: difficulty.optional() })
  .refine((v) => v.rank !== undefined || v.difficulty !== undefined, { message: 'Nothing to update.' });

export const updateDefinitionSchema = z
  .object({ rank: rank.optional(), difficulty: difficulty.optional(), definition: z.string().min(1).max(2000).optional() })
  .refine((v) => v.rank !== undefined || v.difficulty !== undefined || v.definition !== undefined, { message: 'Nothing to update.' });
