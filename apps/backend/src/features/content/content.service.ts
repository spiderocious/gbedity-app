import type { Filter, Document } from 'mongodb';

import { getDb } from '@db/client';

import { ContentCollection, DEFAULT_RATING_FILTER } from './content.constants';

// The content service is the SINGLE server-side gate between Mongo content and a game (PRD §8/§12).
// It rating-filters BEFORE content leaves the server, so a client can never receive — or request —
// content outside the host's selected tiers/tags. Games receive already-resolved, already-filtered
// content in init() (game-engine.md §2.2).

// Structural filter (string arrays) — accepts both the narrow RatingFilter and the engine's
// resolver filter without coupling. The Mongo query only needs the string values.
interface RatingFilterShape {
  tiers: string[];
  excludeTags: string[];
}

// Build the Mongo clause that enforces a rating filter: tier ∈ allowed AND no excluded tag present.
const ratingClause = (filter: RatingFilterShape): Filter<Document> => {
  const clause: Filter<Document> = { ratingTier: { $in: filter.tiers } };
  if (filter.excludeTags.length > 0) {
    clause.tags = { $nin: filter.excludeTags };
  }
  return clause;
};

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIdx: number;
  difficulty: number;
}

export interface WordRow {
  word: string;
  category: string;
  startsWith: string;
}

export interface HotTakePrompt {
  prompt: string;
}

export interface PleadScenario {
  key: string;
  charge: string;
  defendant: string;
  facts: string;
  laws: string;
  precedents: string;
  difficulty: number;
}

export interface PleadRubric {
  criteria: { key: string; label: string; weight: number }[];
}

export class ContentService {
  // Resolve a quiz deck's questions, rating-filtered + difficulty-aware. `sample` caps the count.
  async resolveQuizQuestions(opts: {
    category: string;
    filter?: RatingFilterShape;
    difficulty?: string;
    sample: number;
  }): Promise<QuizQuestion[]> {
    const filter = opts.filter ?? DEFAULT_RATING_FILTER;
    const decks = await getDb()
      .collection(ContentCollection.QUIZ_DECKS)
      .find({ category: opts.category, ...ratingClause(filter) }, { projection: { _id: 0 } })
      .toArray();
    const all = decks.flatMap((d) => (Array.isArray(d.questions) ? (d.questions as QuizQuestion[]) : []));
    return all.slice(0, opts.sample);
  }

  // Distinct categories available in the word DB (for host config / Wordshot enabledCategories).
  async wordCategories(): Promise<string[]> {
    const cats = await getDb().collection(ContentCollection.WORDS).distinct('category');
    return cats.map(String).sort();
  }

  // Count of valid words for a (category, startsWith) — drives Wordshot's "X possible answers" UX
  // and lets the round planner skip empty (letter, category) pairs.
  async wordCount(category: string, startsWith?: string): Promise<number> {
    const q: Filter<Document> = { category };
    if (startsWith !== undefined) q.startsWith = startsWith.toLowerCase();
    return getDb().collection(ContentCollection.WORDS).countDocuments(q);
  }

  async resolveHotTakePrompts(opts: { filter?: RatingFilterShape; sample: number }): Promise<HotTakePrompt[]> {
    const filter = opts.filter ?? DEFAULT_RATING_FILTER;
    const rows = await getDb()
      .collection(ContentCollection.HOT_TAKE_PROMPTS)
      .aggregate([{ $match: ratingClause(filter) }, { $sample: { size: opts.sample } }, { $project: { _id: 0, prompt: 1 } }])
      .toArray();
    return rows.map((r) => ({ prompt: String(r.prompt) }));
  }

  async resolvePleadScenarios(opts: { filter?: RatingFilterShape; sample: number }): Promise<PleadScenario[]> {
    const filter = opts.filter ?? DEFAULT_RATING_FILTER;
    const rows = await getDb()
      .collection(ContentCollection.PLEAD_SCENARIOS)
      .aggregate([{ $match: ratingClause(filter) }, { $sample: { size: opts.sample } }, { $project: { _id: 0 } }])
      .toArray();
    return rows as PleadScenario[];
  }

  async pleadRubric(): Promise<PleadRubric> {
    const doc = await getDb()
      .collection(ContentCollection.PLEAD_RUBRIC)
      .findOne({ key: 'default' }, { projection: { _id: 0, criteria: 1 } });
    return { criteria: (doc?.criteria as PleadRubric['criteria']) ?? [] };
  }

  // Wave 2 resolvers ---------------------------------------------------------

  // Definition Race: sample {word, definition} pairs (obscurity filter optional).
  async resolveDefinitions(opts: { sample: number; obscurity?: string }): Promise<{ word: string; definition: string }[]> {
    const match: Filter<Document> = opts.obscurity && opts.obscurity !== 'mixed' ? { obscurity: opts.obscurity } : {};
    const rows = await getDb()
      .collection(ContentCollection.DEFINITIONS)
      .aggregate([{ $match: match }, { $sample: { size: opts.sample } }, { $project: { _id: 0, word: 1, definition: 1 } }])
      .toArray();
    return rows.map((r) => ({ word: String(r.word), definition: String(r.definition) }));
  }

  // Synonyms/Antonyms: sample prompt words that HAVE the needed relation populated.
  async resolveThesaurusWords(opts: { sample: number; relation: 'synonyms' | 'antonyms'; obscurity?: string }): Promise<string[]> {
    const match: Filter<Document> = { [opts.relation]: { $exists: true, $ne: [] } };
    if (opts.obscurity && opts.obscurity !== 'mixed') match.obscurity = opts.obscurity;
    const rows = await getDb()
      .collection(ContentCollection.THESAURUS)
      .aggregate([{ $match: match }, { $sample: { size: opts.sample } }, { $project: { _id: 0, word: 1 } }])
      .toArray();
    return rows.map((r) => String(r.word));
  }

  // Truth or Dare: sample prompts of a kind, rating-filtered.
  async resolveTruthOrDare(opts: { kind: 'truth' | 'dare'; filter?: RatingFilterShape; sample: number }): Promise<string[]> {
    const filter = opts.filter ?? DEFAULT_RATING_FILTER;
    const rows = await getDb()
      .collection(ContentCollection.TRUTH_OR_DARE_PROMPTS)
      .aggregate([
        { $match: { kind: opts.kind, ...ratingClause(filter) } },
        { $sample: { size: opts.sample } },
        { $project: { _id: 0, prompt: 1 } },
      ])
      .toArray();
    return rows.map((r) => String(r.prompt));
  }
}

export const contentService = new ContentService();
