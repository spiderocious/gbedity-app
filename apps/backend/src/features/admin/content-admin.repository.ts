import { ObjectId } from 'mongodb';

import { getDb } from '@db/client';
import { newId, ID_PREFIX } from '@shared/ids';
import { now, type EpochMs } from '@shared/time';
import { ContentCollection } from '@features/content/content.constants';

// Generic CRUD over the content collections for the admin authoring ports (2.3). Each content kind
// maps to a collection; documents carry a stable `id` + timestamps. Validation of the per-kind
// shape happens in the service (against each game's contentSchema).

const COLLECTION_BY_KIND: Record<string, string> = {
  quiz_deck: ContentCollection.QUIZ_DECKS,
  word: ContentCollection.WORDS,
  hot_take_prompt: ContentCollection.HOT_TAKE_PROMPTS,
  plead_scenario: ContentCollection.PLEAD_SCENARIOS,
  definition: ContentCollection.DEFINITIONS,
  thesaurus: ContentCollection.THESAURUS,
  truth_or_dare_prompt: ContentCollection.TRUTH_OR_DARE_PROMPTS,
  bible_quiz_deck: ContentCollection.BIBLE_QUIZ_DECKS,
  typing_passage: ContentCollection.TYPING_PASSAGES,
  presentation_topic: ContentCollection.PRESENTATION_TOPICS,
  investigation_case: ContentCollection.INVESTIGATION_CASES,
  guess_the_word_pack: ContentCollection.GUESS_THE_WORD_PACKS,
};

export interface ContentDoc {
  id: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  [key: string]: unknown;
}

const coll = (kind: string): string | undefined => COLLECTION_BY_KIND[kind];

export const contentAdminRepository = {
  isKnownKind(kind: string): boolean {
    return coll(kind) !== undefined;
  },

  async create(kind: string, body: Record<string, unknown>): Promise<ContentDoc | null> {
    const c = coll(kind);
    if (!c) return null;
    const doc: ContentDoc = { ...body, id: newId(ID_PREFIX.CONTENT), createdAt: now(), updatedAt: now() };
    await getDb().collection(c).insertOne(doc);
    return doc;
  },

  // Bulk insert pre-validated docs (the controller validates each against the kind schema first).
  async createMany(kind: string, bodies: Record<string, unknown>[]): Promise<ContentDoc[]> {
    const c = coll(kind);
    if (!c || bodies.length === 0) return [];
    const at = now();
    const docs: ContentDoc[] = bodies.map((b) => ({ ...b, id: newId(ID_PREFIX.CONTENT), createdAt: at, updatedAt: at }));
    await getDb().collection(c).insertMany(docs);
    return docs;
  },

  // Cursor on `_id` (ObjectId) — monotonic by insertion and present + type-uniform on EVERY doc,
  // including bulk-restored words whose `createdAt` is a Mongo Date (BUG-C: createdAt cursoring
  // produced NaN sort keys for those). Returns each doc's `_id` as a hex string for the cursor.
  async list(kind: string, opts: { limit: number; beforeId?: string }): Promise<(ContentDoc & { cursorId: string })[]> {
    const c = coll(kind);
    if (!c) return [];
    const filter = opts.beforeId && ObjectId.isValid(opts.beforeId) ? { _id: { $lt: new ObjectId(opts.beforeId) } } : {};
    const docs = await getDb()
      .collection(c)
      .find(filter)
      .sort({ _id: -1 })
      .limit(opts.limit)
      .toArray();
    return docs.map((d) => {
      const { _id, ...rest } = d;
      return { ...(rest as unknown as ContentDoc), cursorId: String(_id) };
    });
  },

  async get(kind: string, id: string): Promise<ContentDoc | null> {
    const c = coll(kind);
    if (!c) return null;
    return getDb().collection<ContentDoc>(c).findOne({ id }, { projection: { _id: 0 } });
  },

  async update(kind: string, id: string, patch: Record<string, unknown>): Promise<ContentDoc | null> {
    const c = coll(kind);
    if (!c) return null;
    const res = await getDb()
      .collection<ContentDoc>(c)
      .findOneAndUpdate(
        { id },
        { $set: { ...patch, updatedAt: now() } },
        { returnDocument: 'after', projection: { _id: 0 } },
      );
    return res ?? null;
  },

  async remove(kind: string, id: string): Promise<boolean> {
    const c = coll(kind);
    if (!c) return false;
    const res = await getDb().collection(c).deleteOne({ id });
    return res.deletedCount === 1;
  },

  // Plead rubric (single doc, key 'default') — recalibration (2.4).
  async getRubric(): Promise<unknown> {
    return getDb().collection(ContentCollection.PLEAD_RUBRIC).findOne({ key: 'default' }, { projection: { _id: 0 } });
  },

  async setRubric(criteria: { key: string; label: string; weight: number }[]): Promise<void> {
    await getDb()
      .collection(ContentCollection.PLEAD_RUBRIC)
      .updateOne({ key: 'default' }, { $set: { key: 'default', criteria, updatedAt: now() } }, { upsert: true });
  },
};
