import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { leagueController } from './league.controller';

const router: IRouter = Router();

// Mounted under /api/v1/rooms/:code/league — league is a room-scoped concern.
router.post('/:code/league', asyncHandler(async (req, res) => leagueController.start(req, res)));
router.get('/:code/league/standings', asyncHandler(async (req, res) => leagueController.standings(req, res)));

export default router;
