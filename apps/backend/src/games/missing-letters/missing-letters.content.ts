import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';

import { pickWords } from '../shared/word-picker';

interface MLConfig {
  rounds: number;
  minLen?: number;
  maxLen?: number;
  hiddenCount?: number;
}

// Deterministic mask: hide `hiddenCount` interior positions, derived from the seed + word so
// recovery/replay reproduce. Keeps the first letter visible for solvability.
const maskPositions = (word: string, hidden: number, seed: string): number[] => {
  const candidates = word.split('').map((_, i) => i).filter((i) => i > 0); // never hide first letter
  // simple seeded shuffle
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const shuffled = [...candidates].sort((a, b) => ((h + a) % 7) - ((h + b) % 7));
  const toHide = new Set(shuffled.slice(0, Math.min(hidden, candidates.length)));
  return word.split('').map((_, i) => i).filter((i) => !toHide.has(i)); // revealed = all minus hidden
};

export const installMissingLettersContent = (): void => {
  registerContentResolver(GameId.MISSING_LETTERS, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as MLConfig;
    const hidden = config.hiddenCount ?? 3;
    const words = await pickWords({
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
