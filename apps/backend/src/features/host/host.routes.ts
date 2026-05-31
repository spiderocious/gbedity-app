import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { hostController } from './host.controller';

const router: IRouter = Router();

router.post('/register', asyncHandler(async (req, res) => hostController.register(req, res)));
router.post('/login', asyncHandler(async (req, res) => hostController.login(req, res)));
router.post('/refresh', asyncHandler(async (req, res) => hostController.refresh(req, res)));

export default router;
