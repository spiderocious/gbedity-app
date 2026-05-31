// Engine-level variant strings. Per game-engine.md §0.5: every variant string is a named
// as-const POJO accessed by key; the union type is derived from it. Never inline a literal.

export const GameCategory = {
  QUICK: 'quick',
  BRAIN: 'brain',
  PARTY: 'party',
  IMMERSIVE: 'immersive',
} as const;
export type GameCategory = (typeof GameCategory)[keyof typeof GameCategory];

export const GameMode = {
  SIMULTANEOUS: 'simultaneous',
  ROUND_ROBIN: 'round_robin',
  SUBMIT_REVEAL: 'submit_reveal',
  SUBMIT_VOTE: 'submit_vote',
  OPEN_PHASE: 'open_phase',
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

export const EffectKind = {
  BROADCAST: 'broadcast',
  TO_PLAYER: 'to_player',
  TO_DISPLAY: 'to_display',
  START_TIMER: 'start_timer',
  CLEAR_TIMER: 'clear_timer',
  REQUEST_VALIDATION: 'request_validation',
  REQUEST_AI: 'request_ai',
  PERSIST_EVENT: 'persist_event',
  ROUND_ENDED: 'round_ended',
  GAME_ENDED: 'game_ended',
} as const;
export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];

export const AudienceKind = {
  HOST: 'host',
  DISPLAY: 'display',
  PLAYER: 'player',
} as const;
export type AudienceKind = (typeof AudienceKind)[keyof typeof AudienceKind];

// Reserved action type for async service results re-entering the plugin (§5).
export const SystemActionType = {
  SERVICE_RESULT: 'system.service_result',
} as const;
export type SystemActionType = (typeof SystemActionType)[keyof typeof SystemActionType];

// Observability event kinds (§9).
export const SessionEventKind = {
  ACTION_IN: 'action_in',
  EFFECT_OUT: 'effect_out',
  STATE_TRANSITION: 'state_transition',
  SNAPSHOT: 'snapshot',
  RECOVERY: 'recovery',
} as const;
export type SessionEventKind = (typeof SessionEventKind)[keyof typeof SessionEventKind];

// Every game id is a named constant — used in URLs and persistence (Sketch & Guess cut for now).
export const GameId = {
  QUIZZES: 'quizzes',
  BIBLE_QUIZ: 'bible_quiz',
  SPELLING_FAST: 'spelling_fast',
  TYPING_FAST: 'typing_fast',
  WORDSHOT: 'wordshot',
  WORD_BOMB: 'word_bomb',
  SCRAMBLED_WORD: 'scrambled_word',
  MISSING_LETTERS: 'missing_letters',
  DEFINITION_RACE: 'definition_race',
  SYNONYMS: 'synonyms',
  ANTONYMS: 'antonyms',
  MILLIONAIRE: 'millionaire',
  TRUTH_OR_DARE: 'truth_or_dare',
  CATCH_THE_LIE: 'catch_the_lie',
  HOT_TAKE_COURT: 'hot_take_court',
  INVESTIGATION: 'investigation',
  PLEAD_YOUR_CASE: 'plead_your_case',
  PRESENTATION: 'presentation',
  // test games used to close the engine contract (game-engine.md §8)
  TEST_SIMULTANEOUS: 'test_simultaneous',
  TEST_ROUND_ROBIN: 'test_round_robin',
} as const;
export type GameId = (typeof GameId)[keyof typeof GameId];
