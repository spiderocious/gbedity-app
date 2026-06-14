import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';

import { pickGameWords } from '../shared/word-picker';
import { maskPositions } from './missing-letters.mask';

interface MLConfig {
  rounds: number;
  minLen?: number;
  maxLen?: number;
  hiddenCount?: number;
}

export const installMissingLettersContent = (): void => {
  registerContentResolver(GameId.MISSING_LETTERS, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as MLConfig;
    const hidden = config.hiddenCount ?? 3;
    const words = await pickGameWords({
      count: config.rounds,
      minLen: config.minLen ?? 4,
      maxLen: config.maxLen ?? 8,
    });
    const list = words.length > 0 ? words : ['banana', 'orange', 'pencil', 'guitar'];
    return {
      words: list.map((answer) => ({ answer, revealed: maskPositions(answer, hidden, `${input.seed}:${answer}`) })),
    };
  });
};
