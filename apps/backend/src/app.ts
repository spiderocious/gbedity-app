import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { register as registerHealth } from '@features/health/index';

const features = [registerHealth];

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

  features.forEach((register) => register(app));

  // Unmatched route → flat error contract.
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  return app;
};
