import type { Collection, Document } from 'mongodb';

import { getDb } from '@db/client';
import { newId, ID_PREFIX } from '@shared/ids';
import { now } from '@shared/time';
import { ContentCollection } from '@features/content/content.constants';

import type { GameWordDoc, GameDefinitionDoc, ReferenceSource, WordSource } from './word-bank.types';

// Data access for the operational collections (game_words, game_definitions) + read access to the
// reference collections (dictionary/allwords/words) the admin promotes from. Pagination is by
// ascending `word` (the natural, stable sort key for a word list).

const gameWords = (): Collection<GameWordDoc> => getDb().collection<GameWordDoc>(ContentCollection.GAME_WORDS);
const gameDefs = (): Collection<GameDefinitionDoc> => getDb().collection<GameDefinitionDoc>(ContentCollection.GAME_DEFINITIONS);

const REFERENCE_COLLECTION: Readonly<Record<ReferenceSource, string>> = {
  dictionary: ContentCollection.DICTIONARY,
  allwords: ContentCollection.ALLWORDS,
  words: ContentCollection.WORDS,
};

export interface PromoteWordInput {
  word: string;
  rank: number;
  difficulty: number;
  source: WordSource;
}

export interface PromoteDefinitionInput {
  word: string;
  definition: string;
  rank: number;
  difficulty: number;
  source: WordSource;
}

export interface ReferenceRow {
  word: string;
  definition?: string; // present for dictionary
  promotedAsWord: boolean;
  promotedAsDefinition: boolean;
}

const cleanWord = (w: string): string => w.trim().toLowerCase();

export const wordBankRepository = {
  async ensureIndexes(): Promise<void> {
    await gameWords().createIndex({ word: 1 }, { unique: true });
    await gameWords().createIndex({ rank: -1 });
    await gameWords().createIndex({ length: 1 });
    await gameDefs().createIndex({ word: 1 }, { unique: true });
    await gameDefs().createIndex({ rank: -1 });
    await gameDefs().createIndex({ length: 1 });
  },

  // ── game_words ──────────────────────────────────────────────────────────────
  async upsertWords(inputs: readonly PromoteWordInput[]): Promise<{ upserted: number }> {
    if (inputs.length === 0) return { upserted: 0 };
    const at = now();
    const ops = inputs.map((input) => {
      const word = cleanWord(input.word);
      return {
        updateOne: {
          filter: { word },
          update: {
            $setOnInsert: { id: newId(ID_PREFIX.GAME_WORD), word, startsWith: word[0] ?? '', length: word.length, createdAt: at },
            $set: { rank: input.rank, difficulty: input.difficulty, source: input.source, updatedAt: at },
          },
          upsert: true,
        },
      };
    });
    const res = await gameWords().bulkWrite(ops, { ordered: false });
    return { upserted: res.upsertedCount + res.modifiedCount };
  },

  async listWords(opts: { limit: number; afterWord?: string; search?: string }): Promise<GameWordDoc[]> {
    const filter: Record<string, unknown> = {};
    if (opts.afterWord !== undefined) filter.word = { $gt: opts.afterWord };
    if (opts.search !== undefined && opts.search !== '') filter.word = { ...(filter.word as object), $regex: `^${escapeRegex(opts.search)}` };
    return gameWords().find(filter, { projection: { _id: 0 } }).sort({ word: 1 }).limit(opts.limit).toArray();
  },

  async updateWord(id: string, patch: { rank?: number | undefined; difficulty?: number | undefined }): Promise<GameWordDoc | null> {
    const set: Record<string, unknown> = { updatedAt: now() };
    if (patch.rank !== undefined) set.rank = patch.rank;
    if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
    const res = await gameWords().findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    return res ?? null;
  },

  async removeWord(id: string): Promise<boolean> {
    const res = await gameWords().deleteOne({ id });
    return res.deletedCount === 1;
  },

  // ── game_definitions ─────────────────────────────────────────────────────────
  async upsertDefinitions(inputs: readonly PromoteDefinitionInput[]): Promise<{ upserted: number }> {
    if (inputs.length === 0) return { upserted: 0 };
    const at = now();
    const ops = inputs.map((input) => {
      const word = cleanWord(input.word);
      return {
        updateOne: {
          filter: { word },
          update: {
            $setOnInsert: { id: newId(ID_PREFIX.GAME_DEFINITION), word, length: word.length, createdAt: at },
            $set: { definition: input.definition.trim(), rank: input.rank, difficulty: input.difficulty, source: input.source, updatedAt: at },
          },
          upsert: true,
        },
      };
    });
    const res = await gameDefs().bulkWrite(ops, { ordered: false });
    return { upserted: res.upsertedCount + res.modifiedCount };
  },

  async listDefinitions(opts: { limit: number; afterWord?: string; search?: string }): Promise<GameDefinitionDoc[]> {
    const filter: Record<string, unknown> = {};
    if (opts.afterWord !== undefined) filter.word = { $gt: opts.afterWord };
    if (opts.search !== undefined && opts.search !== '') filter.word = { ...(filter.word as object), $regex: `^${escapeRegex(opts.search)}` };
    return gameDefs().find(filter, { projection: { _id: 0 } }).sort({ word: 1 }).limit(opts.limit).toArray();
  },

  async updateDefinition(id: string, patch: { rank?: number | undefined; difficulty?: number | undefined; definition?: string | undefined }): Promise<GameDefinitionDoc | null> {
    const set: Record<string, unknown> = { updatedAt: now() };
    if (patch.rank !== undefined) set.rank = patch.rank;
    if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
    if (patch.definition !== undefined) set.definition = patch.definition;
    const res = await gameDefs().findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    return res ?? null;
  },

  async removeDefinition(id: string): Promise<boolean> {
    const res = await gameDefs().deleteOne({ id });
    return res.deletedCount === 1;
  },

  // Sample N words from the dictionary within a length band (used by the seed to top up game_words
  // toward a healthy starting size). Returns clean a–z words with their definition (may be empty).
  async sampleDictionary(opts: { count: number; minLen: number; maxLen: number }): Promise<{ word: string; definition: string }[]> {
    const rows = await getDb()
      .collection(ContentCollection.DICTIONARY)
      .aggregate([
        { $match: { length: { $gte: opts.minLen, $lte: opts.maxLen } } },
        { $sample: { size: opts.count } },
        { $project: { _id: 0, word: 1, definition: 1 } },
      ])
      .toArray();
    return rows
      .map((r) => ({ word: String(r.word).toLowerCase(), definition: String(r.definition ?? '') }))
      .filter((r) => /^[a-z]+$/.test(r.word));
  },

  // Dictionary lookup — used when promoting words to definitions (pull the definition by word).
  async definitionsByWords(words: readonly string[]): Promise<Map<string, string>> {
    const clean = words.map(cleanWord);
    const rows = await getDb()
      .collection(ContentCollection.DICTIONARY)
      .find({ word: { $in: clean } }, { projection: { _id: 0, word: 1, definition: 1 } })
      .toArray();
    const map = new Map<string, string>();
    for (const r of rows) {
      if (typeof r.word === 'string' && typeof r.definition === 'string') map.set(r.word, r.definition);
    }
    return map;
  },

  // ── reference browse (dictionary / allwords / words) ─────────────────────────
  async listReference(opts: { source: ReferenceSource; limit: number; afterWord?: string; search?: string }): Promise<ReferenceRow[]> {
    const coll = getDb().collection<Document>(REFERENCE_COLLECTION[opts.source]);
    const filter: Record<string, unknown> = {};
    if (opts.afterWord !== undefined) filter.word = { $gt: opts.afterWord };
    if (opts.search !== undefined && opts.search !== '') filter.word = { ...(filter.word as object), $regex: `^${escapeRegex(opts.search)}` };

    const rows = await coll
      .find(filter, { projection: { _id: 0, word: 1, definition: 1 } })
      .sort({ word: 1 })
      .limit(opts.limit)
      .toArray();

    const words = rows.map((r) => String(r.word));
    const [promotedWords, promotedDefs] = await Promise.all([
      gameWords().find({ word: { $in: words } }, { projection: { _id: 0, word: 1 } }).toArray(),
      gameDefs().find({ word: { $in: words } }, { projection: { _id: 0, word: 1 } }).toArray(),
    ]);
    const wordSet = new Set(promotedWords.map((d) => d.word));
    const defSet = new Set(promotedDefs.map((d) => d.word));

    return rows.map((r) => {
      const word = String(r.word);
      const row: ReferenceRow = {
        word,
        promotedAsWord: wordSet.has(word),
        promotedAsDefinition: defSet.has(word),
      };
      if (typeof r.definition === 'string') row.definition = r.definition;
      return row;
    });
  },
};

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
