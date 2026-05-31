import { getDb } from '@db/client';
import type { EpochMs } from '@shared/time';

// Admin accounts + refresh-token families (for reuse-revoke). Game-agnostic.

export interface AdminRecord {
  id: string; // a_<ULID>
  email: string;
  passwordHash: string;
  createdAt: EpochMs;
}

// A refresh family: the currently-valid jti for an admin's session chain. Reuse of a superseded
// jti → revoke the whole family (the classic refresh-rotation reuse-detection).
export interface RefreshFamily {
  familyId: string;
  principalId: string;
  currentJti: string;
  revoked: boolean;
  updatedAt: EpochMs;
}

const ADMINS = 'admins';
const FAMILIES = 'refresh_families';

export const adminRepository = {
  async ensureIndexes(): Promise<void> {
    await getDb().collection(ADMINS).createIndex({ email: 1 }, { unique: true });
    await getDb().collection(FAMILIES).createIndex({ familyId: 1 }, { unique: true });
  },

  async count(): Promise<number> {
    return getDb().collection(ADMINS).countDocuments();
  },

  async create(record: AdminRecord): Promise<void> {
    await getDb().collection(ADMINS).insertOne(record);
  },

  async findByEmail(email: string): Promise<AdminRecord | null> {
    return getDb().collection<AdminRecord>(ADMINS).findOne({ email: email.toLowerCase() }, { projection: { _id: 0 } });
  },

  async upsertFamily(family: RefreshFamily): Promise<void> {
    await getDb()
      .collection(FAMILIES)
      .updateOne({ familyId: family.familyId }, { $set: family }, { upsert: true });
  },

  async getFamily(familyId: string): Promise<RefreshFamily | null> {
    return getDb().collection<RefreshFamily>(FAMILIES).findOne({ familyId }, { projection: { _id: 0 } });
  },

  async revokeFamily(familyId: string): Promise<void> {
    await getDb().collection(FAMILIES).updateOne({ familyId }, { $set: { revoked: true } });
  },
};
