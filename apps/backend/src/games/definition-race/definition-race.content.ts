import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface DRConfig {
  rounds: number;
  obscurity?: string;
}

export const installDefinitionRaceContent = (): void => {
  registerContentResolver(GameId.DEFINITION_RACE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as DRConfig;
    const defs = await contentService.resolveDefinitions({
      sample: Math.max(1, config.rounds),
      ...(config.obscurity !== undefined && { obscurity: config.obscurity }),
    });
    const items =
      defs.length > 0
        ? defs.map((d) => ({ definition: d.definition, answer: d.word }))
        : [{ definition: 'A yellow tropical fruit that monkeys love.', answer: 'banana' }];
    return { items };
  });
};
