import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { invSoloController } from './inv-solo.controller';

// Client-driven solo Investigation, mounted under /api/v1/solo/investigation by the solo feature.
// The client paces the case: start → (explore) → accuse. No socket, no engine.
const router: IRouter = Router();

// /cases BEFORE /:soloId so the literal isn't captured as a soloId param.
router.get('/cases', asyncHandler(async (req, res) => invSoloController.cases(req, res)));
router.post('/start', asyncHandler(async (req, res) => invSoloController.start(req, res)));
router.post('/accuse', (req, res) => invSoloController.accuse(req, res));
router.get('/:soloId', (req, res) => invSoloController.snapshot(req, res));

export default router;
