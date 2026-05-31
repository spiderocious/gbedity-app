import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface HotTakeConfig {
  rounds: number;
}

export const installHotTakeContent = (): void => {
  registerContentResolver(GameId.HOT_TAKE_COURT, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as HotTakeConfig;
    const prompts = await contentService.resolveHotTakePrompts({
      filter: input.ratingFilter,
      sample: Math.max(1, config.rounds),
    });
    return { prompts: prompts.length > 0 ? prompts.map((p) => p.prompt) : ['Hot takes coming soon.'] };
  });
};
