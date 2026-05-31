import { MongoClient } from 'mongodb';

import { connectDb, getDb, closeDb } from '../db/client';
import { logger } from '../lib/logger';

// Seed `words` + `allwords` in OUR Mongo from the wordmaster DB.
//
// SMALL SEED (default): up to PER_CATEGORY words from each of the 14 categories + a slice of
// allwords — enough to play + test. The FULL bulk movement is run by the user later (see
// apps/backend/src/seeds/README.md). Idempotent (upsert on word+category). Run with:
//   npx tsx --env-file=.env src/seeds/words.seed.ts

const SRC_URL = process.env.WORDMASTER_URL ?? 'mongodb://127.0.0.1:27017';
const SRC_DB = process.env.WORDMASTER_DB ?? 'wordmaster';
const PER_CATEGORY = Number(process.env.PER_CATEGORY ?? 200);
const ALLWORDS = Number(process.env.ALLWORDS ?? 5000);

// All 14 categories (Q1: keep all). ratingTier=family for every word (Q2).
const CATEGORIES = [
  'animal', 'app', 'bible', 'car', 'city', 'color', 'company', 'country',
  'currency', 'disease', 'food', 'language', 'name', 'place',
];

interface SrcWord {
  word: string;
  category: string;
  startsWith?: string;
  difficulty?: number;
  aliases?: string[];
  popularity?: number;
  isApproved?: boolean;
}

const run = async (): Promise<void> => {
  await connectDb();
  const ddb = getDb();
  const src = new MongoClient(SRC_URL);
  await src.connect();
  const sdb = src.db(SRC_DB);

  const words = ddb.collection('words');
  const allwords = ddb.collection('allwords');

  await words.createIndex({ word: 1 });
  await words.createIndex({ category: 1, startsWith: 1 });
  await words.createIndex({ startsWith: 1 });
  await words.createIndex({ word: 1, category: 1 }, { unique: true });
  await allwords.createIndex({ word: 1 }, { unique: true });

  let total = 0;
  for (const category of CATEGORIES) {
    const sample = (await sdb
      .collection('words')
      .aggregate([{ $match: { category } }, { $sample: { size: PER_CATEGORY } }])
      .toArray()) as SrcWord[];

    if (sample.length === 0) continue;
    await words.bulkWrite(
      sample.map((w) => {
        const word = String(w.word).toLowerCase();
        return {
          updateOne: {
            filter: { word, category: w.category },
            update: {
              $set: {
                word,
                category: w.category,
                startsWith: String(w.startsWith ?? word.charAt(0)).toLowerCase(),
                difficulty: w.difficulty ?? 1,
                aliases: Array.isArray(w.aliases) ? w.aliases : [],
                popularity: w.popularity ?? 0,
                ratingTier: 'family',
                tags: [] as string[],
                isApproved: w.isApproved ?? true,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
    total += sample.length;
    logger.info({ category, seeded: sample.length }, 'words seeded');
  }

  const dict = (await sdb
    .collection('allwords')
    .aggregate([{ $sample: { size: ALLWORDS } }])
    .toArray()) as SrcWord[];
  if (dict.length > 0) {
    await allwords.bulkWrite(
      dict.map((w) => {
        const word = String(w.word).toLowerCase();
        return {
          updateOne: {
            filter: { word },
            update: { $set: { word, startsWith: String(w.startsWith ?? word.charAt(0)).toLowerCase() } },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  logger.info({ words: total, allwords: dict.length }, 'words seed complete');
  await src.close();
  await closeDb();
};

run().catch((err: unknown) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'words seed failed');
  process.exit(1);
});
