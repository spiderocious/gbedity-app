import Redis from 'ioredis';

import { env } from '../env';
import { logger } from './logger';

// Single Redis client for room snapshots; a duplicated connection pair backs pub/sub fanout.
// Connection is lazy and non-fatal: if Redis is unreachable the app still boots (single-instance
// is fine at launch, PRD §11) — snapshot writes simply become best-effort and log a warning.

let client: Redis | null = null;

export const getRedis = (): Redis => {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    client.on('error', (err: Error) => {
      logger.warn({ err: err.message }, 'redis error');
    });
  }
  return client;
};

export const connectRedis = async (): Promise<void> => {
  try {
    await getRedis().connect();
    logger.info({}, 'redis connected');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, 'redis unavailable at boot — snapshots will be best-effort');
  }
};

export const closeRedis = async (): Promise<void> => {
  if (client) {
    client.disconnect();
    client = null;
  }
};
