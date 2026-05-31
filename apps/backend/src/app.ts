import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { register as registerHealth } from '@features/health/index';
import { register as registerRooms } from '@features/rooms/index';
import { errorHandler } from '@middlewares/error-handler.middleware';
import { notFoundHandler } from '@middlewares/not-found.middleware';
import { requestContextMiddleware } from '@middlewares/request-context.middleware';

// Order matters — specific feature routers register before the not-found/error handlers.
const features = [registerHealth, registerRooms];

export const buildApp = (): express.Express => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestContextMiddleware);

  features.forEach((register) => register(app));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
