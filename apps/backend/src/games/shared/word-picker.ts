import { getDb } from '@db/client';
import { ContentCollection } from '@features/content/content.constants';

// Pick N words from the word DB for the casual word games (Missing Letters, Scrambled Word,
// Spelling Fast). Filters by length range; samples randomly. Returns lowercase words.

export const pickWords = async (opts: {
  count: number;
  minLen?: number;
  maxLen?: number;
  category?: string;
}): Promise<string[]> => {
  const match: Record<string, unknown> = {};
  if (opts.category) match.category = opts.category;
  // length filter via $expr on string length
  const lenClause: Record<string, unknown> = {};
  if (opts.minLen !== undefined) lenClause.$gte = opts.minLen;
  if (opts.maxLen !== undefined) lenClause.$lte = opts.maxLen;

  const pipeline: Record<string, unknown>[] = [{ $match: match }];
  if (opts.minLen !== undefined || opts.maxLen !== undefined) {
    pipeline.push({
      $match: {
        $expr: {
          $and: [
            ...(opts.minLen !== undefined ? [{ $gte: [{ $strLenCP: '$word' }, opts.minLen] }] : []),
            ...(opts.maxLen !== undefined ? [{ $lte: [{ $strLenCP: '$word' }, opts.maxLen] }] : []),
          ],
        },
      },
    });
  }
  pipeline.push({ $sample: { size: opts.count } }, { $project: { _id: 0, word: 1 } });

  const rows = await getDb().collection(ContentCollection.WORDS).aggregate(pipeline).toArray();
  return rows.map((r) => String(r.word).toLowerCase()).filter((w) => /^[a-z]+$/.test(w));
};

// Common-English words for the spelling/letter games (Missing Letters, Scrambled Word, Spelling
// Fast). These pull from the `dictionary` collection — real English words WITH definitions, imported
// from a Webster JSON (scripts/import-dictionary.ts) — NOT the category `words` collection, which is
// full of names/cities/countries ("taminasan") that are wrong for a "spell the English word" game.
// Length is a precomputed, indexed field. Single-word, a–z only.
export const pickDictionaryWords = async (opts: {
  count: number;
  minLen?: number;
  maxLen?: number;
}): Promise<string[]> => {
  const lenClause: Record<string, number> = {};
  if (opts.minLen !== undefined) lenClause.$gte = opts.minLen;
  if (opts.maxLen !== undefined) lenClause.$lte = opts.maxLen;

  const pipeline: Record<string, unknown>[] = [];
  if (Object.keys(lenClause).length > 0) pipeline.push({ $match: { length: lenClause } });
  // Oversample, then filter to clean single a–z words client-side (defensive), de-dupe, trim.
  pipeline.push({ $sample: { size: opts.count * 4 } }, { $project: { _id: 0, word: 1 } });

  const rows = await getDb().collection(ContentCollection.DICTIONARY).aggregate(pipeline).toArray();
  const clean = rows.map((r) => String(r.word).toLowerCase()).filter((w) => /^[a-z]+$/.test(w));
  return [...new Set(clean)].slice(0, opts.count);
};

// Word + definition pairs from the `dictionary` collection for Definition Race. Samples words that
// have a non-empty definition, prefers a sensible length band (guessable, not single letters), and
// de-dupes. Returns at most `count`.
export const pickDictionaryDefinitions = async (opts: {
  count: number;
  minLen?: number;
  maxLen?: number;
}): Promise<{ word: string; definition: string }[]> => {
  const lenClause: Record<string, number> = { $gte: opts.minLen ?? 4, $lte: opts.maxLen ?? 12 };

  const rows = await getDb()
    .collection(ContentCollection.DICTIONARY)
    .aggregate([
      { $match: { length: lenClause, definition: { $ne: '' } } },
      { $sample: { size: opts.count * 4 } },
      { $project: { _id: 0, word: 1, definition: 1 } },
    ])
    .toArray();

  const seen = new Set<string>();
  const out: { word: string; definition: string }[] = [];
  for (const r of rows) {
    const word = String(r.word).toLowerCase();
    const definition = String(r.definition ?? '').trim();
    if (!/^[a-z]+$/.test(word) || definition === '' || seen.has(word)) continue;
    seen.add(word);
    out.push({ word, definition });
    if (out.length >= opts.count) break;
  }
  return out;
};

// ── Operational pickers (rank-weighted, with dictionary fallback) ────────────
// The live games draw from the curated operational collections (game_words / game_definitions),
// weighted so higher-rank (more common) words appear more often. If the operational set can't fill
// the request for the requested length band, we top up from the dictionary so games never break.

// A rank-weighted random draw without replacement: each candidate's weight is its rank (1–5), so a
// rank-5 word is ~5× as likely as a rank-1 word to be picked in any given slot.
const weightedSample = <T extends { rank?: number }>(candidates: T[], count: number): T[] => {
  const pool = [...candidates];
  const chosen: T[] = [];
  while (chosen.length < count && pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + Math.max(1, c.rank ?? 1), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i += 1) {
      r -= Math.max(1, pool[i]?.rank ?? 1);
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    chosen.push(pool[idx] as T);
    pool.splice(idx, 1);
  }
  return chosen;
};

interface OperWord {
  word: string;
  rank?: number;
}
interface OperDef {
  word: string;
  definition: string;
  rank?: number;
}

// Words for the spelling/letter games. Operational-first (rank-weighted) → dictionary fallback.
export const pickGameWords = async (opts: {
  count: number;
  minLen?: number;
  maxLen?: number;
}): Promise<string[]> => {
  const lenClause: Record<string, number> = {};
  if (opts.minLen !== undefined) lenClause.$gte = opts.minLen;
  if (opts.maxLen !== undefined) lenClause.$lte = opts.maxLen;
  const match: Record<string, unknown> = Object.keys(lenClause).length > 0 ? { length: lenClause } : {};

  // Pull a generous candidate pool from the operational set, then weight-draw `count`.
  const candidates = (await getDb()
    .collection(ContentCollection.GAME_WORDS)
    .find(match, { projection: { _id: 0, word: 1, rank: 1 } })
    .limit(Math.max(opts.count * 20, 200))
    .toArray()) as unknown as OperWord[];

  const picked = weightedSample(candidates, opts.count)
    .map((c) => c.word.toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w));
  const result = [...new Set(picked)];

  if (result.length < opts.count) {
    const need = opts.count - result.length;
    const have = new Set(result);
    const fallback = await pickDictionaryWords({ count: need * 2, ...(opts.minLen !== undefined && { minLen: opts.minLen }), ...(opts.maxLen !== undefined && { maxLen: opts.maxLen }) });
    for (const w of fallback) {
      if (have.has(w)) continue;
      result.push(w);
      have.add(w);
      if (result.length >= opts.count) break;
    }
  }
  return result.slice(0, opts.count);
};

// Word+definition pairs for Definition Race. Operational-first (rank-weighted) → dictionary fallback.
export const pickGameDefinitions = async (opts: {
  count: number;
  minLen?: number;
  maxLen?: number;
}): Promise<{ word: string; definition: string }[]> => {
  const lenClause: Record<string, number> = { $gte: opts.minLen ?? 4, $lte: opts.maxLen ?? 12 };

  const candidates = (await getDb()
    .collection(ContentCollection.GAME_DEFINITIONS)
    .find({ length: lenClause }, { projection: { _id: 0, word: 1, definition: 1, rank: 1 } })
    .limit(Math.max(opts.count * 20, 200))
    .toArray()) as unknown as OperDef[];

  const seen = new Set<string>();
  const out: { word: string; definition: string }[] = [];
  for (const c of weightedSample(candidates, opts.count)) {
    const word = c.word.toLowerCase();
    const definition = String(c.definition ?? '').trim();
    if (!/^[a-z]+$/.test(word) || definition === '' || seen.has(word)) continue;
    seen.add(word);
    out.push({ word, definition });
  }

  if (out.length < opts.count) {
    const fallback = await pickDictionaryDefinitions({ count: (opts.count - out.length) * 2, ...(opts.minLen !== undefined && { minLen: opts.minLen }), ...(opts.maxLen !== undefined && { maxLen: opts.maxLen }) });
    for (const d of fallback) {
      if (seen.has(d.word)) continue;
      seen.add(d.word);
      out.push(d);
      if (out.length >= opts.count) break;
    }
  }
  return out.slice(0, opts.count);
};
