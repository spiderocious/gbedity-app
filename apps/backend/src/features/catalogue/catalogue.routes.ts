import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';

import { catalogueController } from './catalogue.controller';

const router: IRouter = Router();

// Public, unauthenticated — the landing showcase reads this (PRD §6). Admin authoring/curation
// endpoints live under /api/v1/admin/catalogue (behind requireAdmin).
router.get('/', asyncHandler(async (req, res) => catalogueController.list(req, res)));

export default router;
