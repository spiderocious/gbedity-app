import { z } from 'zod';

import { RatingTier, ContentTag } from '@features/content/content.constants';

// Per-kind admin content-authoring schemas (BUG-B). Validate the AUTHORED DOCUMENT shape — distinct
// from a game's runtime Content (which the content service derives). Every content row MUST carry a
// ratingTier (a missing tier is a rating-filter hole), so it's required here.

const ratingTier = z.nativeEnum(RatingTier);
const tags = z.array(z.nativeEnum(ContentTag)).default([]);

const quizDeck = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  ratingTier,
  tags,
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        answerIdx: z.number().int().min(0).max(3),
        difficulty: z.number().int().min(1).max(3).default(1),
      }),
    )
    .min(1),
});

const word = z.object({
  word: z.string().min(1),
  category: z.string().min(1),
  startsWith: z.string().length(1),
  difficulty: z.number().int().min(1).max(3).default(1),
  aliases: z.array(z.string()).default([]),
  ratingTier,
  tags,
});

const hotTakePrompt = z.object({
  prompt: z.string().min(1),
  ratingTier,
  tags,
});

const pleadScenario = z.object({
  key: z.string().min(1),
  charge: z.string().min(1),
  defendant: z.string().min(1),
  facts: z.string().min(1),
  laws: z.string().min(1),
  precedents: z.string().min(1),
  ratingTier,
  tags,
  difficulty: z.number().int().min(1).max(3).default(1),
});

// Wave 2 content kinds.
const definition = z.object({
  word: z.string().min(1),
  definition: z.string().min(1),
  obscurity: z.enum(['common', 'academic']).default('common'),
  ratingTier,
  tags,
});

const thesaurus = z.object({
  word: z.string().min(1),
  synonyms: z.array(z.string().min(1)).default([]),
  antonyms: z.array(z.string().min(1)).default([]),
  obscurity: z.enum(['common', 'academic']).default('common'),
  ratingTier,
  tags,
});

const truthOrDarePrompt = z.object({
  kind: z.enum(['truth', 'dare']),
  prompt: z.string().min(1),
  ratingTier,
  tags,
});

// Full schema (create) and a partial variant (PATCH).
const SCHEMAS: Record<string, z.ZodTypeAny> = {
  quiz_deck: quizDeck,
  word,
  hot_take_prompt: hotTakePrompt,
  plead_scenario: pleadScenario,
  definition,
  thesaurus,
  truth_or_dare_prompt: truthOrDarePrompt,
};

export const contentSchemaFor = (kind: string): z.ZodTypeAny | undefined => SCHEMAS[kind];
