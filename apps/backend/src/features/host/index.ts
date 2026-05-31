import type { Express } from 'express';

import { hostRepository } from './host.repository';
import hostRoutes from './host.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/host', hostRoutes);
};

export const ensureHostIndexes = async (): Promise<void> => {
  await hostRepository.ensureIndexes();
};
