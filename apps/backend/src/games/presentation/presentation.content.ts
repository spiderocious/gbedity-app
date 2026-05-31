import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface PresConfig {
  rounds: number;
}

export const installPresentationContent = (): void => {
  registerContentResolver(GameId.PRESENTATION, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as PresConfig;
    // one topic per presenter per round; over-sample a little
    const topics = await contentService.resolvePresentationTopics({ filter: input.ratingFilter, sample: Math.max(4, config.rounds * 6) });
    return { topics: topics.length > 0 ? topics : ['Why your favourite food is the best food.'] };
  });
};
