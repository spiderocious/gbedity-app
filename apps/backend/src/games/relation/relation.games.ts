import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

import { makeRelationGame } from './relation-game.factory';

export const synonymsGame = makeRelationGame({
  id: GameId.SYNONYMS,
  title: 'Synonyms',
  relation: 'synonyms',
  actionType: 'synonyms.submit',
  eventType: 'synonyms.submit',
});

export const antonymsGame = makeRelationGame({
  id: GameId.ANTONYMS,
  title: 'Antonyms',
  relation: 'antonyms',
  actionType: 'antonyms.submit',
  eventType: 'antonyms.submit',
});

interface RelConfig {
  rounds: number;
  obscurity?: string;
}

const installResolver = (id: typeof GameId.SYNONYMS | typeof GameId.ANTONYMS, relation: 'synonyms' | 'antonyms'): void => {
  registerContentResolver(id, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as RelConfig;
    const words = await contentService.resolveThesaurusWords({
      sample: Math.max(1, config.rounds),
      relation,
      ...(config.obscurity !== undefined && { obscurity: config.obscurity }),
    });
    return { words: words.length > 0 ? words : ['happy'] };
  });
};

export const installRelationContent = (): void => {
  installResolver(GameId.SYNONYMS, 'synonyms');
  installResolver(GameId.ANTONYMS, 'antonyms');
};
