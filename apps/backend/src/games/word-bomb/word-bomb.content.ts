import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

// Resolves Word Bomb content: pick one category (the host's, or a seeded well-stocked one).

interface WordBombConfig {
  category?: string;
}

export const installWordBombContent = (): void => {
  registerContentResolver(GameId.WORD_BOMB, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as WordBombConfig;
    if (config.category) return { category: config.category };

    const cats = await contentService.wordCategories();
    // deterministic-ish pick from seed; fall back to first.
    const idx = input.seed.length % Math.max(1, cats.length);
    return { category: cats[idx] ?? cats[0] ?? 'animal' };
  });
};
