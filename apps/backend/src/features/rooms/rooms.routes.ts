import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { roomsController } from './rooms.controller';

const router: IRouter = Router();

// Specific routes before parameterized ones (route order matters in Express).
router.post('/', asyncHandler(async (req, res) => roomsController.create(req, res)));
router.get('/:code', asyncHandler(async (req, res) => roomsController.lobby(req, res)));
router.post('/:code/players', asyncHandler(async (req, res) => roomsController.join(req, res)));

export default router;
