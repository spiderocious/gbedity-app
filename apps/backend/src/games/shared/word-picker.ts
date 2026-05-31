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
