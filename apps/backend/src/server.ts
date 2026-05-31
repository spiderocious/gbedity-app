import { createServer, type Server } from 'node:http';

import { buildApp } from './app';
import { closeDb, connectDb } from './db/client';
import { env } from './env';
import { closeRedis, connectRedis } from '@lib/redis';
import { attachRoomGateway } from '@engine/gateway';
import { logger } from '@lib/logger';

const startHttpApp = async (): Promise<Server> => {
  await connectDb();
  await connectRedis();

  const app = buildApp();
  const server = createServer(app);

  // Real-time room gateway (Socket.IO) shares the HTTP server.
  attachRoomGateway(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'gbedity-backend listening');
  });
  return server;
};

const serverPromise = startHttpApp();

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down gracefully');
  const server = await serverPromise;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDb();
  await closeRedis();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

serverPromise.catch((err) => {
  logger.error({ err }, 'failed to start gbedity-backend');
  process.exit(1);
});
