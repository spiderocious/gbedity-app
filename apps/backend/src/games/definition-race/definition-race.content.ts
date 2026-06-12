import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

import { pickGameDefinitions } from '../shared/word-picker';

interface DRConfig {
  rounds: number;
  obscurity?: string;
}

export const installDefinitionRaceContent = (): void => {
  registerContentResolver(GameId.DEFINITION_RACE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as DRConfig;
    const rounds = Math.max(1, config.rounds);

    // Prefer curated definitions (authored, obscurity-tagged); top up from the dictionary so the
    // game never runs short — the dictionary carries real word→definition pairs (Webster import).
    const authored = await contentService.resolveDefinitions({
      sample: rounds,
      ...(config.obscurity !== undefined && { obscurity: config.obscurity }),
    });

    const items = authored.map((d) => ({ definition: d.definition, answer: d.word }));
    if (items.length < rounds) {
      const have = new Set(items.map((i) => i.answer));
      const extra = await pickGameDefinitions({ count: rounds - items.length });
      for (const e of extra) {
        if (have.has(e.word)) continue;
        items.push({ definition: e.definition, answer: e.word });
      }
    }

    const final =
      items.length > 0 ? items : [{ definition: 'A yellow tropical fruit that monkeys love.', answer: 'banana' }];
    return { items: final };
  });
};
