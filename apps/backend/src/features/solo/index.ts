import type { Express } from 'express';

import mlSoloRoutes from './missing-letters/ml-solo.routes';
import wsSoloRoutes from './wordshot/ws-solo.routes';
import wwtbamSoloRoutes from './millionaire/wwtbam-solo.routes';
import invSoloRoutes from './investigation/inv-solo.routes';
import soloRoutes from './solo.routes';

export const register = (app: Express): void => {
  // Specific game sub-surfaces BEFORE the generic solo router so their paths aren't shadowed by
  // the generic router's GET /:soloId. All run client-driven (REST, no socket).
  app.use('/api/v1/solo/missing-letters', mlSoloRoutes);
  app.use('/api/v1/solo/wordshot', wsSoloRoutes);
  app.use('/api/v1/solo/millionaire', wwtbamSoloRoutes);
  app.use('/api/v1/solo/investigation', invSoloRoutes);
  app.use('/api/v1/solo', soloRoutes);
};
