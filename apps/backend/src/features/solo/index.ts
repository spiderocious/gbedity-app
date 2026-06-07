import type { Express } from 'express';

import soloRoutes from './solo.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/solo', soloRoutes);
};
