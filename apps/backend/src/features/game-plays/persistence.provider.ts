import { setPersistenceHook } from '@engine/services/persistence-hook';
import { now } from '@shared/time';
import { logger } from '@lib/logger';

import { gamePlaysRepository } from './game-plays.repository';

// Installs the Mongo-backed persistence hook into the engine (layering: engine never imports
// @features). Writes are fire-and-forget; failures log but never break gameplay.

export const installPersistenceHook = async (): Promise<void> => {
  await gamePlaysRepository.ensureIndexes();

  setPersistenceHook({
    recordEvent: (event): void => {
      void gamePlaysRepository.insertEvent(event).catch((err: unknown) => {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'persist event failed');
      });
    },
    recordPlay: (summary): void => {
      void gamePlaysRepository
        .insertPlay({ ...summary, createdAt: now() })
        .catch((err: unknown) => {
          logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'persist play failed');
        });
    },
  });
};
