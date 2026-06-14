import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { wwtbamSoloController } from './wwtbam-solo.controller';

// Client-driven solo WWTBAM, mounted under /api/v1/solo/millionaire by the solo feature.
// Specific routes BEFORE the param route /:soloId (Express specificity rule).
const router: IRouter = Router();

router.post('/start', asyncHandler(async (req, res) => wwtbamSoloController.start(req, res)));
router.post('/question', (req, res) => wwtbamSoloController.question(req, res));
router.post('/answer', (req, res) => wwtbamSoloController.answer(req, res));
router.post('/next', (req, res) => wwtbamSoloController.next(req, res));
router.post('/fifty-fifty', (req, res) => wwtbamSoloController.fiftyFifty(req, res));
router.get('/:soloId', (req, res) => wwtbamSoloController.snapshot(req, res));

export default router;
