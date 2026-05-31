import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';

import { pickWords } from '../shared/word-picker';

interface SWConfig {
  rounds: number;
  minLen?: number;
  maxLen?: number;
}

// Seeded scramble — deterministic per (seed, word) so recovery/replay reproduce. Ensures the
// scramble differs from the answer when possible.
const scramble = (word: string, seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const chars = word.split('');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const out = chars.join('');
  return out === word && word.length > 1 ? word.split('').reverse().join('') : out;
};

export const installScrambledWordContent = (): void => {
  registerContentResolver(GameId.SCRAMBLED_WORD, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as SWConfig;
    const words = await pickWords({ count: config.rounds, minLen: config.minLen ?? 5, maxLen: config.maxLen ?? 8 });
    const list = words.length > 0 ? words : ['planet', 'guitar', 'orange', 'silver'];
    return { words: list.map((answer) => ({ answer, scrambled: scramble(answer, `${input.seed}:${answer}`) })) };
  });
};
