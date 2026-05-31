import type { Express } from 'express';

import roomRoutes from './rooms.routes';

export const register = (app: Express): void => {
  app.use('/api/v1/rooms', roomRoutes);
};
