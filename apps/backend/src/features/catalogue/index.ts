import type { Express } from 'express';

import { catalogueRepository } from './catalogue.repository';
import catalogueRoutes from './catalogue.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/catalogue', catalogueRoutes);
};

// Ensure indexes at boot (called from bootstrap).
export const ensureCatalogueIndexes = async (): Promise<void> => {
  await catalogueRepository.ensureIndexes();
};
