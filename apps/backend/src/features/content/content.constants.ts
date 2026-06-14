// Content domain constants (no inline variant strings — §0.5). Shared by the content service,
// rating filter, and the admin authoring ports.

export const ContentKind = {
  QUIZ_DECK: 'quiz_deck',
  WORD: 'word',
  HOT_TAKE_PROMPT: 'hot_take_prompt',
  PLEAD_SCENARIO: 'plead_scenario',
  // Wave 2 content kinds
  DEFINITION: 'definition', // { word, definition }
  THESAURUS: 'thesaurus', // { word, synonyms[], antonyms[] }
  TRUTH_OR_DARE_PROMPT: 'truth_or_dare_prompt', // { kind: truth|dare, prompt }
  // Wave 3 content kinds
  BIBLE_QUIZ_DECK: 'bible_quiz_deck', // { translation, testament, questions[] }
  TYPING_PASSAGE: 'typing_passage', // { text, length, source }
  PRESENTATION_TOPIC: 'presentation_topic', // { topic }
  INVESTIGATION_CASE: 'investigation_case', // rich case: suspects[], reports[], witnesses[], transcripts[], timeline[], tools[], solution + keyEvidence + explanation
} as const;
export type ContentKind = (typeof ContentKind)[keyof typeof ContentKind];

// Rating tiers (PRD §8). Ordered loosely family → 18+; the host selects which tiers are allowed.
export const RatingTier = {
  FAMILY: 'family',
  FRIENDS: 'friends',
  SPICY: 'spicy',
  EIGHTEEN_PLUS: 'eighteen_plus',
} as const;
export type RatingTier = (typeof RatingTier)[keyof typeof RatingTier];

export const ContentTag = {
  SEXUAL: 'sexual',
  RELIGIOUS: 'religious',
  POLITICAL: 'political',
  PHYSICAL: 'physical',
  RELATIONSHIP: 'relationship',
  UNDER_18_INAPPROPRIATE: 'under_18_inappropriate',
} as const;
export type ContentTag = (typeof ContentTag)[keyof typeof ContentTag];

// Mongo collection names per content kind.
export const ContentCollection = {
  QUIZ_DECKS: 'quiz_decks',
  WORDS: 'words',
  ALLWORDS: 'allwords',
  DICTIONARY: 'dictionary', // common-English word→definition source (Webster import) for the word games
  // Operational sets — the curated, RANKED words/definitions the live games actually draw from.
  // Fed by the seed script + admin promotion from the reference collections above.
  GAME_WORDS: 'game_words', // Missing Letters / Scrambled Word / Spelling Fast
  GAME_DEFINITIONS: 'game_definitions', // Definition Race

  HOT_TAKE_PROMPTS: 'hot_take_prompts',
  PLEAD_SCENARIOS: 'plead_scenarios',
  PLEAD_RUBRIC: 'plead_rubric',
  DEFINITIONS: 'definitions',
  THESAURUS: 'thesaurus',
  TRUTH_OR_DARE_PROMPTS: 'truth_or_dare_prompts',
  BIBLE_QUIZ_DECKS: 'bible_quiz_decks',
  TYPING_PASSAGES: 'typing_passages',
  PRESENTATION_TOPICS: 'presentation_topics',
  INVESTIGATION_CASES: 'investigation_cases',
} as const;

// The host's content filter (PRD §8): which tiers are allowed + which tags to exclude.
export interface RatingFilter {
  tiers: RatingTier[];
  excludeTags: ContentTag[];
}

export const DEFAULT_RATING_FILTER: RatingFilter = {
  tiers: [RatingTier.FAMILY],
  excludeTags: [],
};
