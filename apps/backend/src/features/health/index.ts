import type { Express } from 'express';

import healthRoutes from './health.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/health', healthRoutes);
};
