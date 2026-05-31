import { closeRedis } from '@lib/redis';

// Ensure the lazy Redis client doesn't keep the event loop alive after the suite finishes.
afterAll(async () => {
  await closeRedis();
});
