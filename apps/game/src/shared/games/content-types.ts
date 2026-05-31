import type { ReactNode } from 'react';

import type { ConfigGroup } from './config-schema.ts';
import type { GameKey } from './games-manifest.ts';

// The per-game content contract. The universal shells (configure §4, in-game §5, post-game
// §6) read this registry and slot each game's content in. One implementation of every
// shell; 18 data/render entries here. Keeps ~120 per-game screen states DRY.

export interface PostGameStat {
  readonly label: string;
  readonly value: string;
}

export interface GameContent {
  readonly key: GameKey;
  /** Configure groups for the §4 shell. */
  readonly configGroups: readonly ConfigGroup[];
  /** Live preview-rail lines for the §4 configure shell. */
  readonly previewLines: readonly string[];
  /** Centre-card content for the §5 display in-game view (mock active state). */
  readonly renderDisplay: () => ReactNode;
  /** Player phone input area for the §5 player in-game view (mock active state). */
  readonly renderPlayer: () => ReactNode;
  /** Celebration content above the winner bar for the §6 post-game shell. */
  readonly renderCelebration: () => ReactNode;
  /** Extra flavour stats shown in the post-game card. */
  readonly postGameStats: readonly PostGameStat[];
}
