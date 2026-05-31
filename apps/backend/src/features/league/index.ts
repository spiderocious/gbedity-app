import type { Express } from 'express';

import leagueRoutes from './league.routes';

export const register = (app: Express): void => {
  // Room-scoped — shares the /rooms prefix.
  app.use('/api/v1/rooms', leagueRoutes);
};
