import type { CategoryKey } from '@gbedity/ui';

import { GameCategory } from '../../../shared/games/games-manifest.ts';

// Mock "in-game moment" frames for the hero demo montage. These are STATIC presentational
// snapshots — no game logic, no live state — that show what a moment of play looks like.
// When the real in-game screens exist, the montage swaps to render those instead; the
// frame `kind` is the seam. Discriminant kinds are named constants (no inline strings).

export const MomentKind = {
  WORD_BOMB: 'word-bomb',
  HOT_TAKE: 'hot-take',
  PLEAD_VERDICT: 'plead-verdict',
  WORDSHOT: 'wordshot',
  CATCH_THE_LIE: 'catch-the-lie',
} as const;
export type MomentKind = (typeof MomentKind)[keyof typeof MomentKind];

interface MomentBase {
  /** Small overline shown above every frame — the game name. */
  readonly label: string;
  /** Category — drives the frame's accent tint. */
  readonly category: CategoryKey;
}

export interface WordBombMoment extends MomentBase {
  readonly kind: typeof MomentKind.WORD_BOMB;
  readonly seconds: number;
  readonly promptCategory: string;
  readonly prompt: string;
}

export interface HotTakeMoment extends MomentBase {
  readonly kind: typeof MomentKind.HOT_TAKE;
  readonly prompt: string;
  readonly winner: string;
  readonly votes: number;
}

export interface PleadVerdictCriterion {
  readonly label: string;
  readonly value: number;
}

export interface PleadVerdictMoment extends MomentBase {
  readonly kind: typeof MomentKind.PLEAD_VERDICT;
  readonly score: number;
  readonly criteria: readonly PleadVerdictCriterion[];
}

export interface WordshotMoment extends MomentBase {
  readonly kind: typeof MomentKind.WORDSHOT;
  readonly letter: string;
  readonly prompt: string;
}

export interface CatchTheLieMoment extends MomentBase {
  readonly kind: typeof MomentKind.CATCH_THE_LIE;
  readonly statements: readonly string[];
}

export type HeroMoment =
  | WordBombMoment
  | HotTakeMoment
  | PleadVerdictMoment
  | WordshotMoment
  | CatchTheLieMoment;

export const HERO_MOMENTS: readonly HeroMoment[] = [
  {
    kind: MomentKind.WORD_BOMB,
    label: 'Word Bomb',
    category: GameCategory.CASUAL,
    seconds: 4,
    promptCategory: 'Nigerian foods',
    prompt: 'Type one nobody has said',
  },
  {
    kind: MomentKind.WORDSHOT,
    label: 'Wordshot',
    category: GameCategory.CASUAL,
    letter: 'A',
    prompt: 'A famous Nigerian',
  },
  {
    kind: MomentKind.HOT_TAKE,
    label: 'Hot Take Court',
    category: GameCategory.PARTY,
    prompt: 'Jollof is overrated',
    winner: 'Most convincing defence',
    votes: 7,
  },
  {
    kind: MomentKind.CATCH_THE_LIE,
    label: 'Catch the Lie',
    category: GameCategory.PARTY,
    statements: [
      'I once met Burna Boy at a bus stop',
      'I can solve a Rubik’s cube in under a minute',
      'I have never tasted Indomie',
    ],
  },
  {
    kind: MomentKind.PLEAD_VERDICT,
    label: 'Plead Your Case',
    category: GameCategory.IMMERSIVE,
    score: 86,
    criteria: [
      { label: 'Soundness', value: 88 },
      { label: 'Persuasion', value: 84 },
      { label: 'Precedent', value: 86 },
    ],
  },
];
