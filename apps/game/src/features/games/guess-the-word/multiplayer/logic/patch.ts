import type { ViewPatch } from '../../../../../shared/types/view.ts';

// Narrows the raw ViewPatch → a fully-typed GtwView for Guess The Word.
// All optional fields are given safe defaults so the rest of the slice never null-guards the same
// field twice.

export const GtwPhase = {
  TURN_INTRO: 'turn_intro',
  GUESSING: 'guessing',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
export type GtwPhase = (typeof GtwPhase)[keyof typeof GtwPhase];

export interface GtwBoardRow {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

export interface GtwView {
  readonly phase: GtwPhase | string;
  readonly guesserId: string | null;
  readonly moderatorId: string | null;
  readonly order: string[];
  readonly turnIdx: number;
  readonly questionCount: number;
  readonly deadline: number | null;
  readonly guessSeconds: number;
  // guesser: char count of the secret (? chars excluded)
  readonly wordLength: number | null;
  // audience + display + guesser at reveal
  readonly word: string | null;
  readonly isModerator: boolean;
  readonly isGuesser: boolean;
  readonly guessText: string | null;
  readonly correct: boolean | null;
  readonly board: GtwBoardRow[];
  readonly yourScore: number;
}

export function toGtwView(patch: ViewPatch): GtwView {
  return {
    phase: typeof patch.phase === 'string' ? patch.phase : GtwPhase.TURN_INTRO,
    guesserId: typeof patch.guesserId === 'string' ? patch.guesserId : null,
    moderatorId: typeof patch.moderatorId === 'string' ? patch.moderatorId : null,
    order: Array.isArray(patch.order) ? (patch.order as string[]) : [],
    turnIdx: typeof patch.turnIdx === 'number' ? patch.turnIdx : 0,
    questionCount: typeof patch.questionCount === 'number' ? patch.questionCount : 20,
    deadline: typeof patch.deadline === 'number' ? patch.deadline : null,
    guessSeconds: typeof patch.guessSeconds === 'number' ? patch.guessSeconds : 90,
    wordLength: typeof patch.wordLength === 'number' ? patch.wordLength : null,
    word: typeof patch.word === 'string' ? patch.word : null,
    isModerator: patch.isModerator === true,
    isGuesser: patch.isGuesser === true,
    guessText: typeof patch.guessText === 'string' ? patch.guessText : null,
    correct: typeof patch.correct === 'boolean' ? patch.correct : null,
    board: Array.isArray(patch.board)
      ? (patch.board as GtwBoardRow[])
      : [],
    yourScore: typeof patch.yourScore === 'number' ? patch.yourScore : 0,
  };
}
