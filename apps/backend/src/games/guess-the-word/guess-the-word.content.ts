import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

// Resolve a Guess The Word content pack. Picks one admin-curated pack from the
// `guess_the_word_packs` collection. Falls back to a built-in pack if none exist yet.

const FALLBACK = {
  packTitle: 'Everyday Things',
  packCategory: 'General',
  words: ['elephant', 'umbrella', 'bicycle', 'keyboard', 'butterfly', 'telescope', 'strawberry', 'fireplace', 'lighthouse', 'waterfall'],
};

interface GuessTheWordConfig {
  category?: string;
}

export const installGuessTheWordContent = (): void => {
  registerContentResolver(GameId.GUESS_THE_WORD, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as GuessTheWordConfig;
    const pack = await contentService.resolveGuessTheWordPack({
      filter: input.ratingFilter,
      ...(config.category !== undefined ? { category: config.category } : {}),
    });
    if (!pack) return FALLBACK;
    return {
      packTitle: pack.title,
      packCategory: pack.category,
      words: pack.words,
    };
  });
};
