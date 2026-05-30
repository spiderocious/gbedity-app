import { MongoClient, type Db } from 'mongodb';

import { env } from '../env';
import { logger } from '@lib/logger';

// The only place a MongoClient is created. Everything downstream takes a `Db`.

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectDb = async (): Promise<Db> => {
  if (db) return db;
  client = new MongoClient(env.MONGO_URL, {
    ignoreUndefined: true,
    retryWrites: false,
  });
  await client.connect();
  db = client.db(env.MONGO_DB_NAME);
  logger.info({ dbName: env.MONGO_DB_NAME }, 'mongo connected');
  return db;
};

export const getDb = (): Db => {
  if (!db) throw new Error('Database not connected. Call connectDb() at boot.');
  return db;
};

export const closeDb = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};
