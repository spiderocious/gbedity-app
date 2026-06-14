import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { wsSoloController } from './ws-solo.controller';

// Client-driven solo Wordshot, mounted under /api/v1/solo/wordshot by the solo feature.
const router: IRouter = Router();

router.post('/start', asyncHandler(async (req, res) => wsSoloController.start(req, res)));
router.post('/round', (req, res) => wsSoloController.round(req, res));
router.post('/guess', asyncHandler(async (req, res) => wsSoloController.guess(req, res)));
router.post('/next', (req, res) => wsSoloController.next(req, res));
router.get('/:soloId', (req, res) => wsSoloController.snapshot(req, res));

export default router;
