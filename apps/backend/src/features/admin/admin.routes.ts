import { Router, type IRouter } from 'express';

import { asyncHandler } from '@shared/http/async-handler';
import { requireAdmin } from '@middlewares/admin-auth.middleware';

import { adminController } from './admin.controller';
import { wordBankController } from '@features/word-bank/word-bank.controller';

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

// Catalogue authoring + curation (game-catalogue.md §3.2). Eligible games = registered plugins;
// admin authors the presentation + activates/deactivates. Specific `/activate` + `/deactivate`
// before the bare `/:gameId` so they aren't matched as a gameId.
router.get('/catalogue', asyncHandler(async (req, res) => adminController.listCatalogue(req, res)));
router.post('/catalogue', asyncHandler(async (req, res) => adminController.createCatalogue(req, res)));
router.post('/catalogue/:gameId/activate', asyncHandler(async (req, res) => adminController.activateCatalogue(req, res)));
router.post('/catalogue/:gameId/deactivate', asyncHandler(async (req, res) => adminController.deactivateCatalogue(req, res)));
router.get('/catalogue/:gameId', asyncHandler(async (req, res) => adminController.getCatalogue(req, res)));
router.patch('/catalogue/:gameId', asyncHandler(async (req, res) => adminController.updateCatalogue(req, res)));
router.delete('/catalogue/:gameId', asyncHandler(async (req, res) => adminController.deleteCatalogue(req, res)));

// Word bank — browse reference collections + promote into the operational sets (game_words /
// game_definitions) the word games draw from, and manage rank/difficulty. Specific list/promote
// routes before the parameterized `/:id` so they aren't matched as ids.
router.get('/word-sources/:source', asyncHandler(async (req, res) => wordBankController.listReference(req, res)));

router.get('/game-words', asyncHandler(async (req, res) => wordBankController.listWords(req, res)));
router.post('/game-words/promote', asyncHandler(async (req, res) => wordBankController.promoteWords(req, res)));
router.patch('/game-words/:id', asyncHandler(async (req, res) => wordBankController.updateWord(req, res)));
router.delete('/game-words/:id', asyncHandler(async (req, res) => wordBankController.deleteWord(req, res)));

router.get('/game-definitions', asyncHandler(async (req, res) => wordBankController.listDefinitions(req, res)));
router.post('/game-definitions/promote', asyncHandler(async (req, res) => wordBankController.promoteDefinitions(req, res)));
router.patch('/game-definitions/:id', asyncHandler(async (req, res) => wordBankController.updateDefinition(req, res)));
router.delete('/game-definitions/:id', asyncHandler(async (req, res) => wordBankController.deleteDefinition(req, res)));

export default router;
