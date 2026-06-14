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

// Wave 3 content kinds.
const bibleQuizDeck = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  translation: z.enum(['mixed', 'kjv', 'niv', 'nlt', 'yoruba', 'igbo', 'hausa']).default('mixed'),
  testament: z.enum(['both', 'old', 'new']).default('both'),
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

const typingPassage = z.object({
  text: z.string().min(1),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  source: z.enum(['general', 'nigerian', 'bible', 'pidgin', 'quotes']).default('general'),
  ratingTier,
  tags,
});

const presentationTopic = z.object({
  topic: z.string().min(1),
  ratingTier,
  tags,
});

// Rich case file (matches the plugin contentSchema). Enums are authored as strings; keep them in
// lock-step with investigation.plugin.ts. solutionSuspectId / keyEvidenceId are top-level so the
// admin authoring `selfRef` (top-level only) can validate them.
const iAlibiStatus = z.enum(['confirmed', 'shaky', 'broken', 'unchecked']);
const iReportKind = z.enum(['autopsy', 'forensic', 'financial', 'digital']);
const iFindingFlag = z.enum(['key', 'herring', 'none']);
const iReliability = z.enum(['reliable', 'questionable', 'hostile']);
const iLineRole = z.enum(['q', 'a']);
const iToolOutcome = z.enum(['hit', 'partial', 'dead_end']);
const iToolIcon = z.enum(['identity', 'phone_records', 'call_log', 'triangulation', 'crime_db']);
const iKeyValue = z.object({ label: z.string().min(1), value: z.string().min(1) });

const investigationCase = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1).default('Investigation'),
  brief: z.string().min(1), // the case setup
  suspects: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        age: z.number().int().nonnegative().default(0),
        role: z.string().min(1),
        motive: z.string().min(1),
        alibi: z.string().min(1),
        alibiStatus: iAlibiStatus.default('unchecked'),
        phone: z.string().default(''),
        note: z.string().default(''),
      }),
    )
    .min(2),
  reports: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: iReportKind,
        title: z.string().min(1),
        subtitle: z.string().default(''),
        header: z.array(iKeyValue).default([]),
        findings: z.array(z.object({ heading: z.string().min(1), detail: z.string().min(1), flag: iFindingFlag.default('none') })).default([]),
      }),
    )
    .default([]),
  witnesses: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1), relation: z.string().min(1), statement: z.string().min(1), reliability: iReliability.default('reliable') }))
    .default([]),
  transcripts: z
    .array(
      z.object({
        id: z.string().min(1),
        suspectId: z.string().min(1), // references a suspects[].id (plain field — nested refs aren't validated by admin)
        title: z.string().min(1),
        lines: z.array(z.object({ speaker: z.string().min(1), role: iLineRole, text: z.string().min(1) })).default([]),
      }),
    )
    .default([]),
  timeline: z.array(z.object({ time: z.string().min(1), event: z.string().min(1), source: z.string().default(''), conflict: z.boolean().default(false) })).default([]),
  tools: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        tagline: z.string().default(''),
        icon: iToolIcon,
        results: z.array(z.object({ query: z.string().min(1), outcome: iToolOutcome, rows: z.array(iKeyValue).default([]), note: z.string().default('') })).default([]),
      }),
    )
    .default([]),
  solutionSuspectId: z.string().min(1), // the guilty suspect (server-only until reveal)
  keyEvidenceId: z.string().default(''), // the report id that proves it (bonus on accuse)
  explanation: z.string().default(''), // the reveal narrative
  difficulty: z.number().int().min(1).max(3).default(1),
  ratingTier,
  tags,
});

// Guess The Word — admin-curated word packs. Each pack is a themed set of words (one word per turn).
// `words` supports `?` as a wildcard/blank character (e.g. "b?nana" has a gap the guesser must fill).
const guessTheWordPack = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  words: z.array(z.string().min(1)).min(1),
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
  bible_quiz_deck: bibleQuizDeck,
  typing_passage: typingPassage,
  presentation_topic: presentationTopic,
  investigation_case: investigationCase,
  guess_the_word_pack: guessTheWordPack,
};

export const contentSchemaFor = (kind: string): z.ZodTypeAny | undefined => SCHEMAS[kind];
