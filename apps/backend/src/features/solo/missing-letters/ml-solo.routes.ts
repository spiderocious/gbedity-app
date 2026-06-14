import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { mlSoloController } from './ml-solo.controller';

// Client-driven solo Missing Letters, mounted under /api/v1/solo/missing-letters by the solo
// feature. The client drives the flow: start → round → guess → next … No socket, no engine.
const router: IRouter = Router();

router.post('/start', asyncHandler(async (req, res) => mlSoloController.start(req, res)));
router.post('/round', (req, res) => mlSoloController.round(req, res));
router.post('/guess', (req, res) => mlSoloController.guess(req, res));
router.post('/next', (req, res) => mlSoloController.next(req, res));
router.get('/:soloId', (req, res) => mlSoloController.snapshot(req, res));

export default router;
