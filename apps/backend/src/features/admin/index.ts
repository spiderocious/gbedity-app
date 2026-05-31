import type { Express } from 'express';

import { adminRepository } from './admin.repository';
import adminRoutes from './admin.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/admin', adminRoutes);
};

// Ensure indexes at boot (called from bootstrap).
export const ensureAdminIndexes = async (): Promise<void> => {
  await adminRepository.ensureIndexes();
};
