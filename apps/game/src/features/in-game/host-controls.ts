import { LiveGameId } from './resolve-live-game.ts';

// Per-game host controls. Controls are NOT one hardcoded set — each game declares which it shows.
// `endGame` is universal (every game can be ended). `skip` advances the current phase early and only
// makes sense for timer/round-paced games. "Open display" was removed (the display is a spectator
// surface opened independently, not a host control). Add per-game controls here as games need them.

export interface HostControls {
  readonly skip: boolean;
}

const DEFAULT_CONTROLS: HostControls = { skip: false };

const BY_GAME: Partial<Record<string, HostControls>> = {
  // Round/timer-paced word + quiz games → skip advances to the next round/question.
  [LiveGameId.MISSING_LETTERS]: { skip: true },
  [LiveGameId.QUIZZES]: { skip: true },
  bible_quiz: { skip: true },
  [LiveGameId.WORDSHOT]: { skip: true },
  scrambled_word: { skip: true },
  definition_race: { skip: true },
  synonyms: { skip: true },
  antonyms: { skip: true },
  spelling_fast: { skip: true },
  typing_fast: { skip: true },
  // Turn-paced (round-robin) → skip advances the current turn/holder.
  [LiveGameId.WORD_BOMB]: { skip: true },
  truth_or_dare: { skip: true },
  presentation: { skip: true },
  millionaire: { skip: true },
  // Submit/vote + immersive → skip advances the current phase (submission → vote → reveal, etc.).
  [LiveGameId.HOT_TAKE_COURT]: { skip: true },
  catch_the_lie: { skip: true },
  [LiveGameId.PLEAD_YOUR_CASE]: { skip: true },
  investigation: { skip: true },
};

// Controls for a game (by backend gameId). Unknown/undefined → defaults (End game only).
export function hostControlsFor(gameId: string | undefined): HostControls {
  if (gameId === undefined) return DEFAULT_CONTROLS;
  return BY_GAME[gameId] ?? DEFAULT_CONTROLS;
}
