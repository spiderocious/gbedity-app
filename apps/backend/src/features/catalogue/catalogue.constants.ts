import { GameId } from '@engine/constants';

// Catalogue feature constants + the engine→UI encoding translation (spec: docs/backend/specs/
// game-catalogue.md §1). The backend does ALL translation so the public endpoint emits exactly the
// shape the landing showcase already consumes (apps/game/src/shared/games/games-manifest.ts).
// Per §0.5 / no-inline-variant-strings: every variant is a named as-const value; the GameId→UI
// mapping is one named table, never scattered literals.

export const CatalogueStatus = {
  DRAFT: 'draft', // created, not yet shown to users
  ACTIVE: 'active', // approved → served by the public endpoint
  INACTIVE: 'inactive', // pulled from the public endpoint (kept, not deleted)
} as const;
export type CatalogueStatus = (typeof CatalogueStatus)[keyof typeof CatalogueStatus];

// The UI's CategoryKey (apps: 'casual'|'brain'|'party'|'immersive'). The engine uses 'quick' where
// the UI uses 'casual'; the rest match. Named here so the mapping is one source.
export const UiCategory = {
  CASUAL: 'casual',
  BRAIN: 'brain',
  PARTY: 'party',
  IMMERSIVE: 'immersive',
} as const;
export type UiCategory = (typeof UiCategory)[keyof typeof UiCategory];

// One row per catalogue game: how the engine GameId maps to the UI's encoding.
//  - prdId: PRD §6 catalogue number (1–19; 15 = Sketch & Guess, cut). Numeric id the UI keys on.
//  - key:   kebab-case GameKey the UI uses (engine GameId is snake_case).
//  - uiCategory: the UI CategoryKey (engine 'quick' → UI 'casual').
// Test games (TEST_*) are intentionally absent — they are never cataloged.
interface UiMapping {
  readonly prdId: number;
  readonly key: string;
  readonly uiCategory: UiCategory;
}

export const GAME_UI_MAPPING: Readonly<Record<string, UiMapping>> = {
  [GameId.QUIZZES]: { prdId: 1, key: 'quizzes', uiCategory: UiCategory.CASUAL },
  [GameId.BIBLE_QUIZ]: { prdId: 2, key: 'bible-quiz', uiCategory: UiCategory.CASUAL },
  [GameId.SPELLING_FAST]: { prdId: 3, key: 'spelling-fast', uiCategory: UiCategory.CASUAL },
  [GameId.TYPING_FAST]: { prdId: 4, key: 'typing-fast', uiCategory: UiCategory.CASUAL },
  [GameId.WORDSHOT]: { prdId: 5, key: 'wordshot', uiCategory: UiCategory.CASUAL },
  [GameId.WORD_BOMB]: { prdId: 6, key: 'word-bomb', uiCategory: UiCategory.CASUAL },
  [GameId.SCRAMBLED_WORD]: { prdId: 7, key: 'scrambled-word', uiCategory: UiCategory.CASUAL },
  [GameId.MISSING_LETTERS]: { prdId: 8, key: 'missing-letters', uiCategory: UiCategory.CASUAL },
  [GameId.DEFINITION_RACE]: { prdId: 9, key: 'definition-race', uiCategory: UiCategory.CASUAL },
  [GameId.SYNONYMS]: { prdId: 10, key: 'synonyms', uiCategory: UiCategory.CASUAL },
  [GameId.ANTONYMS]: { prdId: 11, key: 'antonyms', uiCategory: UiCategory.CASUAL },
  [GameId.MILLIONAIRE]: { prdId: 12, key: 'millionaire', uiCategory: UiCategory.BRAIN },
  [GameId.TRUTH_OR_DARE]: { prdId: 13, key: 'truth-or-dare', uiCategory: UiCategory.PARTY },
  [GameId.CATCH_THE_LIE]: { prdId: 14, key: 'catch-the-lie', uiCategory: UiCategory.PARTY },
  // 15 = Sketch & Guess — cut.
  [GameId.HOT_TAKE_COURT]: { prdId: 16, key: 'hot-take-court', uiCategory: UiCategory.PARTY },
  [GameId.INVESTIGATION]: { prdId: 17, key: 'investigation', uiCategory: UiCategory.IMMERSIVE },
  [GameId.PLEAD_YOUR_CASE]: { prdId: 18, key: 'plead-your-case', uiCategory: UiCategory.IMMERSIVE },
  [GameId.PRESENTATION]: { prdId: 19, key: 'presentation', uiCategory: UiCategory.IMMERSIVE },
  [GameId.GUESS_THE_WORD]: { prdId: 20, key: 'guess-the-word', uiCategory: UiCategory.PARTY },
};

export const uiMappingFor = (gameId: string): UiMapping | undefined => GAME_UI_MAPPING[gameId];

// Mongo collection holding admin-curated catalogue entries.
export const CATALOGUE_COLLECTION = 'catalogue_entries';

// Format the UI `meta` line, e.g. "2–10 · 7m". An unbounded max (null) renders the recommendedMax
// as the upper bound — matching the current static manifest (e.g. wordshot "2–10"). En dash per the
// existing manifest copy. Single source so the format never drifts between games (spec §3.1).
export const formatMeta = (min: number, max: number | null, recommendedMax: number, estMinutes: number): string => {
  const upper = max ?? recommendedMax;
  const range = min === upper ? `${min}` : `${min}–${upper}`;
  return `${range} · ${estMinutes}m`;
};
