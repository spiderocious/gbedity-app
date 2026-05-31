import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';
import { requireAdmin } from '@middlewares/admin-auth.middleware';

import { adminController } from './admin.controller';

const router: IRouter = Router();

// Public auth endpoints.
router.post('/seed', asyncHandler(async (req, res) => adminController.seed(req, res)));
router.post('/login', asyncHandler(async (req, res) => adminController.login(req, res)));
router.post('/refresh', asyncHandler(async (req, res) => adminController.refresh(req, res)));

// Everything below requires an admin access token.
router.use(requireAdmin);

// History + metrics (specific paths before the parameterized content routes).
router.get('/game-plays', asyncHandler(async (req, res) => adminController.listGamePlays(req, res)));
router.get('/game-plays/:id', asyncHandler(async (req, res) => adminController.getGamePlay(req, res)));
router.get('/sessions/:instanceId/events', asyncHandler(async (req, res) => adminController.sessionEvents(req, res)));
router.get('/metrics', asyncHandler(async (req, res) => adminController.metrics(req, res)));

// Rubric recalibration.
router.get('/rubric', asyncHandler(async (req, res) => adminController.getRubric(req, res)));
router.put('/rubric', asyncHandler(async (req, res) => adminController.setRubric(req, res)));

// Content authoring — full CRUD per kind. `:kind` ∈ quiz_deck | word | hot_take_prompt |
// plead_scenario | definition | thesaurus | truth_or_dare_prompt | bible_quiz_deck |
// typing_passage | presentation_topic | investigation_case.
// Specific `/bulk` route registered before `/:id` so "bulk" isn't matched as an id.
router.post('/content/:kind/bulk', asyncHandler(async (req, res) => adminController.bulkCreateContent(req, res)));
router.post('/content/:kind', asyncHandler(async (req, res) => adminController.createContent(req, res)));
router.get('/content/:kind', asyncHandler(async (req, res) => adminController.listContent(req, res)));
router.get('/content/:kind/:id', asyncHandler(async (req, res) => adminController.getContent(req, res)));
router.patch('/content/:kind/:id', asyncHandler(async (req, res) => adminController.updateContent(req, res)));
router.delete('/content/:kind/:id', asyncHandler(async (req, res) => adminController.deleteContent(req, res)));

export default router;
