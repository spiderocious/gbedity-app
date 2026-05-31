import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';

import { pickWords } from '../shared/word-picker';

interface SFConfig {
  rounds: number;
  minLen?: number;
  maxLen?: number;
}

export const installSpellingFastContent = (): void => {
  registerContentResolver(GameId.SPELLING_FAST, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as SFConfig;
    // medium-length words make a fair spelling challenge
    const words = await pickWords({ count: config.rounds, minLen: config.minLen ?? 5, maxLen: config.maxLen ?? 9 });
    return { words: words.length > 0 ? words : ['necessary', 'rhythm', 'separate', 'definitely'] };
  });
};
