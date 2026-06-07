import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { soloController } from './solo.controller';

const router: IRouter = Router();

// Single-player. Unauthenticated (no account needed — default nickname "You").
// Specific `/games` before `/:soloId` so it isn't matched as a solo id.
router.get('/games', (req, res) => soloController.games(req, res));
router.post('/start', asyncHandler(async (req, res) => soloController.start(req, res)));
router.get('/:soloId', (req, res) => soloController.state(req, res));

export default router;
