// Content domain constants (no inline variant strings — §0.5). Shared by the content service,
// rating filter, and the admin authoring ports.

export const ContentKind = {
  QUIZ_DECK: 'quiz_deck',
  WORD: 'word',
  HOT_TAKE_PROMPT: 'hot_take_prompt',
  PLEAD_SCENARIO: 'plead_scenario',
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
  HOT_TAKE_PROMPTS: 'hot_take_prompts',
  PLEAD_SCENARIOS: 'plead_scenarios',
  PLEAD_RUBRIC: 'plead_rubric',
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
