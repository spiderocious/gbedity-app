import { getDb } from '@db/client';
import type { EpochMs } from '@shared/time';

// Optional host accounts (PRD §9 — minimal PII: email + password). Shares the refresh-family
// reuse-revoke pattern with admin but its own collections.

export interface HostRecord {
  id: string; // h_<ULID>
  email: string;
  passwordHash: string;
  createdAt: EpochMs;
}

export interface HostRefreshFamily {
  familyId: string;
  principalId: string;
  currentJti: string;
  revoked: boolean;
  updatedAt: EpochMs;
}

const HOSTS = 'hosts';
const FAMILIES = 'host_refresh_families';

export const hostRepository = {
  async ensureIndexes(): Promise<void> {
    await getDb().collection(HOSTS).createIndex({ email: 1 }, { unique: true });
    await getDb().collection(FAMILIES).createIndex({ familyId: 1 }, { unique: true });
  },

  async findByEmail(email: string): Promise<HostRecord | null> {
    return getDb().collection<HostRecord>(HOSTS).findOne({ email: email.toLowerCase() }, { projection: { _id: 0 } });
  },

  async create(record: HostRecord): Promise<void> {
    await getDb().collection(HOSTS).insertOne(record);
  },

  async upsertFamily(family: HostRefreshFamily): Promise<void> {
    await getDb().collection(FAMILIES).updateOne({ familyId: family.familyId }, { $set: family }, { upsert: true });
  },

  async getFamily(familyId: string): Promise<HostRefreshFamily | null> {
    return getDb().collection<HostRefreshFamily>(FAMILIES).findOne({ familyId }, { projection: { _id: 0 } });
  },

  async revokeFamily(familyId: string): Promise<void> {
    await getDb().collection(FAMILIES).updateOne({ familyId }, { $set: { revoked: true } });
  },
};
