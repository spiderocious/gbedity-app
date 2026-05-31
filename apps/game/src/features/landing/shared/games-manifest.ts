import type { CategoryKey } from '@gbedity/ui';

// Static catalogue for the landing showcase. No fetch — this is the bare-UI source
// of truth. When the backend lands, the catalogue API returns this same LandingGame
// shape, so the showcase reads it unchanged and wiring is a drop-in swap.
//
// Per the project rule (no inline variant strings): every game key and category is a
// named constant in an `as const` POJO; the union types are derived from them and the
// category type is the library's CategoryKey so GameTile and the filter share one source.
//
// Source: PRD §6 (catalogue). Sketch & Guess (#15) is intentionally skipped for now,
// so this manifest holds 18 games; the original PRD ids 1–19 are preserved (15 absent).

export type GameCategory = CategoryKey;

export const GameCategory = {
  CASUAL: 'casual',
  BRAIN: 'brain',
  PARTY: 'party',
  IMMERSIVE: 'immersive',
} as const satisfies Record<string, CategoryKey>;

/** Short uppercase tag shown on a GameTile's tinted top, per category. */
export const CATEGORY_TAG: Record<GameCategory, string> = {
  casual: 'Quick',
  brain: 'Brain',
  party: 'Party',
  immersive: 'Immersive',
};

/** Human-readable category labels for the filter chips. */
export const CATEGORY_LABEL: Record<GameCategory, string> = {
  casual: 'Quick & Casual',
  brain: 'Brain & Strategy',
  party: 'Party & Social',
  immersive: 'Immersive',
};

/** Render order of category filter chips. */
export const CATEGORY_ORDER: readonly GameCategory[] = [
  GameCategory.CASUAL,
  GameCategory.BRAIN,
  GameCategory.PARTY,
  GameCategory.IMMERSIVE,
];

export const GameKey = {
  QUIZZES: 'quizzes',
  BIBLE_QUIZ: 'bible-quiz',
  SPELLING_FAST: 'spelling-fast',
  TYPING_FAST: 'typing-fast',
  WORDSHOT: 'wordshot',
  WORD_BOMB: 'word-bomb',
  SCRAMBLED_WORD: 'scrambled-word',
  MISSING_LETTERS: 'missing-letters',
  DEFINITION_RACE: 'definition-race',
  SYNONYMS: 'synonyms',
  ANTONYMS: 'antonyms',
  MILLIONAIRE: 'millionaire',
  TRUTH_OR_DARE: 'truth-or-dare',
  CATCH_THE_LIE: 'catch-the-lie',
  HOT_TAKE_COURT: 'hot-take-court',
  INVESTIGATION: 'investigation',
  PLEAD_YOUR_CASE: 'plead-your-case',
  PRESENTATION: 'presentation',
} as const;
export type GameKey = (typeof GameKey)[keyof typeof GameKey];

export interface LandingGame {
  /** PRD catalogue id (1–19; 15 omitted — Sketch & Guess skipped). */
  readonly id: number;
  readonly key: GameKey;
  readonly category: GameCategory;
  /** Player-count + time meta, e.g. "2–10 · 8m". */
  readonly meta: string;
  readonly title: string;
  readonly description: string;
}

export const GAMES: readonly LandingGame[] = [
  {
    id: 1,
    key: GameKey.QUIZZES,
    category: GameCategory.CASUAL,
    meta: '2–10 · 8m',
    title: 'Quizzes',
    description: 'Multiple-choice trivia. Faster correct answers earn more points.',
  },
  {
    id: 2,
    key: GameKey.BIBLE_QUIZ,
    category: GameCategory.CASUAL,
    meta: '2–10 · 8m',
    title: 'Bible Quiz',
    description: 'Scripture trivia with translation and testament filters.',
  },
  {
    id: 3,
    key: GameKey.SPELLING_FAST,
    category: GameCategory.CASUAL,
    meta: '2–12 · 6m',
    title: 'Spelling Fast',
    description: 'A word is read aloud — never shown. Race to spell it right.',
  },
  {
    id: 4,
    key: GameKey.TYPING_FAST,
    category: GameCategory.CASUAL,
    meta: '2–12 · 6m',
    title: 'Typing Fast',
    description: 'A passage appears. Race to type it accurately. Speed times accuracy.',
  },
  {
    id: 5,
    key: GameKey.WORDSHOT,
    category: GameCategory.CASUAL,
    meta: '2–10 · 7m',
    title: 'Wordshot',
    description: 'A letter and a category. Type a valid answer that fits, fast.',
  },
  {
    id: 6,
    key: GameKey.WORD_BOMB,
    category: GameCategory.CASUAL,
    meta: '3–10 · 7m',
    title: 'Word Bomb',
    description: 'A ticking bomb passes round-robin. Hold it longer for more points.',
  },
  {
    id: 7,
    key: GameKey.SCRAMBLED_WORD,
    category: GameCategory.CASUAL,
    meta: '2–10 · 7m',
    title: 'Scrambled Word',
    description: 'Unscramble the word. Guesses rank live by closeness.',
  },
  {
    id: 8,
    key: GameKey.MISSING_LETTERS,
    category: GameCategory.CASUAL,
    meta: '2–10 · 6m',
    title: 'Missing Letters',
    description: 'Fill the gaps in the word. Faster correct earns more.',
  },
  {
    id: 9,
    key: GameKey.DEFINITION_RACE,
    category: GameCategory.CASUAL,
    meta: '2–10 · 7m',
    title: 'Definition Race',
    description: 'A definition appears. Race to name the word, ranked live.',
  },
  {
    id: 10,
    key: GameKey.SYNONYMS,
    category: GameCategory.CASUAL,
    meta: '2–10 · 6m',
    title: 'Synonyms',
    description: 'A word appears. Type a valid synonym. Rarer scores higher.',
  },
  {
    id: 11,
    key: GameKey.ANTONYMS,
    category: GameCategory.CASUAL,
    meta: '2–10 · 6m',
    title: 'Antonyms',
    description: 'A word appears. Type a valid antonym. Rarer scores higher.',
  },
  {
    id: 12,
    key: GameKey.MILLIONAIRE,
    category: GameCategory.BRAIN,
    meta: '2–10 · 15m',
    title: 'Who Wants to Be a Millionaire',
    description: 'A graduated ladder, taken in turns. Lifelines included. Bank the most.',
  },
  {
    id: 13,
    key: GameKey.TRUTH_OR_DARE,
    category: GameCategory.PARTY,
    meta: '2–12 · 10m',
    title: 'Truth or Dare',
    description: 'Pick truth or dare. The room votes on whether you delivered.',
  },
  {
    id: 14,
    key: GameKey.CATCH_THE_LIE,
    category: GameCategory.PARTY,
    meta: '3–10 · 10m',
    title: 'Catch the Lie',
    description: 'Two truths and a lie, revealed anonymously. Spot the lie.',
  },
  {
    id: 16,
    key: GameKey.HOT_TAKE_COURT,
    category: GameCategory.PARTY,
    meta: '3–15 · 10m',
    title: 'Hot Take Court',
    description: 'A spicy prompt. Defend it in one line. The room votes the winner.',
  },
  {
    id: 17,
    key: GameKey.INVESTIGATION,
    category: GameCategory.IMMERSIVE,
    meta: '2–8 · 30m',
    title: 'Investigation',
    description: 'Work the case from your phone, then name who is responsible.',
  },
  {
    id: 18,
    key: GameKey.PLEAD_YOUR_CASE,
    category: GameCategory.IMMERSIVE,
    meta: '2–10 · 12m',
    title: 'Plead Your Case',
    description: 'Argue the defence. An AI scores soundness, persuasion, and precedent.',
  },
  {
    id: 19,
    key: GameKey.PRESENTATION,
    category: GameCategory.IMMERSIVE,
    meta: '2–10 · 12m',
    title: 'Presentation',
    description: 'Present a cold topic for 90 seconds. The room rates you.',
  },
];
