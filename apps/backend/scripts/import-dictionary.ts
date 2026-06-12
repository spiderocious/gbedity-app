import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { connectDb, closeDb, getDb } from '../src/db/client';
import { ContentCollection } from '../src/features/content/content.constants';

// One-shot importer: load a Webster-style { "word": "definition", ... } JSON into the `dictionary`
// collection — clean, common-ish English with definitions, the source for the spelling/letter games
// and Definition Race. Normalises to single a–z words, precomputes length + startsWith, and indexes
// them. Idempotent (upsert by word). Run:
//   tsx --env-file=.env scripts/import-dictionary.ts [path/to/dictionary.json]

interface DictDoc {
  word: string;
  startsWith: string;
  length: number;
  definition: string;
}

const DEFAULT_PATH = '/Users/feranmi/codebases/2026/dockito/dump/dictionary.json';

// A keeper word: a single lowercase a–z token, length ≥ 2 (1-letter words are useless for the games).
const isCleanWord = (w: string): boolean => /^[a-z]{2,}$/.test(w);

const main = async (): Promise<void> => {
  const path = resolve(process.argv[2] ?? DEFAULT_PATH);
  console.log(`reading ${path} …`);
  const raw = readFileSync(path, 'utf8');
  const map = JSON.parse(raw) as Record<string, unknown>;
  const totalKeys = Object.keys(map).length;
  console.log(`parsed ${totalKeys.toLocaleString()} entries`);

  // Build clean docs, de-duped by normalised word (a word can appear with different casing).
  const byWord = new Map<string, DictDoc>();
  let skipped = 0;
  for (const [key, value] of Object.entries(map)) {
    const word = key.trim().toLowerCase();
    if (!isCleanWord(word)) {
      skipped += 1;
      continue;
    }
    const definition = typeof value === 'string' ? value.trim() : '';
    if (!byWord.has(word)) {
      byWord.set(word, { word, startsWith: word[0] as string, length: word.length, definition });
    }
  }
  const docs = [...byWord.values()];
  console.log(`kept ${docs.length.toLocaleString()} clean words (skipped ${skipped.toLocaleString()} non-words/duplicates)`);

  await connectDb();
  const collection = getDb().collection<DictDoc>(ContentCollection.DICTIONARY);

  // Indexes: unique word (the upsert key), plus length + startsWith for the games' filters.
  await collection.createIndex({ word: 1 }, { unique: true });
  await collection.createIndex({ length: 1 });
  await collection.createIndex({ startsWith: 1 });

  // Bulk upsert in batches so a re-run refreshes definitions without duplicating.
  const BATCH = 5000;
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const ops = slice.map((doc) => ({
      updateOne: { filter: { word: doc.word }, update: { $set: doc }, upsert: true },
    }));
    const res = await collection.bulkWrite(ops, { ordered: false });
    written += res.upsertedCount + res.modifiedCount;
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, docs.length).toLocaleString()} / ${docs.length.toLocaleString()}`);
  }
  process.stdout.write('\n');

  const finalCount = await collection.countDocuments();
  const withDefs = await collection.countDocuments({ definition: { $ne: '' } });
  console.log(`done. dictionary collection now has ${finalCount.toLocaleString()} words (${withDefs.toLocaleString()} with definitions). writes this run: ${written.toLocaleString()}`);

  await closeDb();
};

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
