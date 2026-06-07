import { getDb } from '@db/client';
import { newId, ID_PREFIX } from '@shared/ids';
import { now, type EpochMs } from '@shared/time';

import { CATALOGUE_COLLECTION, CatalogueStatus, type CatalogueStatus as Status } from './catalogue.constants';

// Mongo CRUD over `catalogue_entries` (spec §2). One entry per game — `gameId` is the unique join
// key to the plugin registry. Stores ONLY admin-authored presentation; title/category/mode/players
// come live from the plugin manifest at request time (service layer). Mirrors content-admin.repository:
// stable `id`, epoch-ms timestamps, `_id` projected out of reads.

export interface CatalogueEntryDoc {
  id: string; // cat_<ULID>
  gameId: string; // engine GameId — unique
  status: Status;
  description: string;
  estMinutes: number;
  iconName: string;
  playersMinOverride?: number;
  playersMaxOverride?: number | null;
  sortOrder: number;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export type CatalogueEntryInput = Omit<CatalogueEntryDoc, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

const collection = () => getDb().collection<CatalogueEntryDoc>(CATALOGUE_COLLECTION);

export const catalogueRepository = {
  // Unique index on gameId enforces one-entry-per-game; status+sortOrder serves the public list path.
  async ensureIndexes(): Promise<void> {
    await collection().createIndex({ gameId: 1 }, { unique: true });
    await collection().createIndex({ status: 1, sortOrder: 1 });
  },

  async getByGameId(gameId: string): Promise<CatalogueEntryDoc | null> {
    return collection().findOne({ gameId }, { projection: { _id: 0 } });
  },

  // Active entries, ordered for the showcase. Bounded by the game set, so no pagination (spec §3.1).
  async listActive(): Promise<CatalogueEntryDoc[]> {
    return collection()
      .find({ status: CatalogueStatus.ACTIVE }, { projection: { _id: 0 } })
      .sort({ sortOrder: 1 })
      .toArray();
  },

  // Every entry (any status) for the admin authoring view, ordered.
  async listAll(): Promise<CatalogueEntryDoc[]> {
    return collection().find({}, { projection: { _id: 0 } }).sort({ sortOrder: 1 }).toArray();
  },

  async create(input: CatalogueEntryInput): Promise<CatalogueEntryDoc> {
    const at = now();
    const doc: CatalogueEntryDoc = {
      ...input,
      id: newId(ID_PREFIX.CATALOGUE),
      status: CatalogueStatus.DRAFT, // starts as a draft; admin activates explicitly
      createdAt: at,
      updatedAt: at,
    };
    await collection().insertOne(doc);
    return doc;
  },

  async update(gameId: string, patch: Partial<CatalogueEntryInput>): Promise<CatalogueEntryDoc | null> {
    const res = await collection().findOneAndUpdate(
      { gameId },
      { $set: { ...patch, updatedAt: now() } },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    return res ?? null;
  },

  async setStatus(gameId: string, status: Status): Promise<CatalogueEntryDoc | null> {
    const res = await collection().findOneAndUpdate(
      { gameId },
      { $set: { status, updatedAt: now() } },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    return res ?? null;
  },

  async remove(gameId: string): Promise<boolean> {
    const res = await collection().deleteOne({ gameId });
    return res.deletedCount === 1;
  },
};
