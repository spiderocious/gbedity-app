import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

import { assignCategories, generateLetters, type LetterDifficulty } from '../shared/letter-category';

// Resolves the Wordshot round plan server-side: pick letters (seeded) + a category per letter from
// the host's enabled set (default all, name/city/country always on — Q1). Skips (letter,category)
// pairs with no valid words so a round is always answerable.

interface WordshotConfig {
  rounds: number;
  letterDifficulty?: LetterDifficulty;
  enabledCategories?: string[];
}

const DEFAULT_ON = ['name', 'city', 'country']; // Q1: always enabled by default

export const installWordshotContent = (): void => {
  registerContentResolver(GameId.WORDSHOT, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as WordshotConfig;
    const allCats = await contentService.wordCategories();
    const enabled =
      config.enabledCategories && config.enabledCategories.length > 0
        ? Array.from(new Set([...config.enabledCategories, ...DEFAULT_ON])).filter((c) => allCats.includes(c))
        : allCats;

    // Over-generate then filter to non-empty pairs; trim to rounds.
    const letters = generateLetters(input.seed, config.rounds * 3, config.letterDifficulty);
    const cats = assignCategories(input.seed, letters, enabled.length > 0 ? enabled : allCats);

    const plan: { letter: string; category: string }[] = [];
    for (let i = 0; i < letters.length && plan.length < config.rounds; i += 1) {
      const letter = letters[i]!;
      const category = cats[i]!;
      const count = await contentService.wordCount(category, letter);
      if (count > 0) plan.push({ letter, category });
    }
    // Fallback: if somehow empty, force at least one common pair.
    if (plan.length === 0) plan.push({ letter: 'a', category: enabled[0] ?? allCats[0] ?? 'animal' });
    return { plan };
  });
};
