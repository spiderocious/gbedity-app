import { wordBankRepository, type PromoteWordInput, type PromoteDefinitionInput } from './word-bank.repository';
import { WordSource, type ReferenceSource } from './word-bank.types';
import type { PromoteWordsInput, PromoteDefinitionsInput } from './word-bank.schema';

// Word-bank business logic: promote words/definitions from the reference collections into the
// operational sets, and manage what's promoted. No HTTP awareness.

const sourceToWordSource = (source: ReferenceSource | undefined): WordSource =>
  source === undefined ? WordSource.MANUAL : (source as WordSource);

export const wordBankService = {
  async promoteWords(input: PromoteWordsInput): Promise<{ upserted: number; total: number }> {
    const src = sourceToWordSource(input.source);
    const inputs: PromoteWordInput[] = input.items.map((item) => ({
      word: item.word,
      rank: item.rank ?? input.defaultRank ?? 3,
      difficulty: item.difficulty ?? input.defaultDifficulty ?? 2,
      source: src,
    }));
    const res = await wordBankRepository.upsertWords(inputs);
    return { upserted: res.upserted, total: inputs.length };
  },

  async promoteDefinitions(input: PromoteDefinitionsInput): Promise<{ upserted: number; total: number; missingDefinition: string[] }> {
    const src = sourceToWordSource(input.source);

    // Pull definitions from the dictionary for any item that didn't supply one.
    const needLookup = input.items.filter((i) => i.definition === undefined).map((i) => i.word.toLowerCase());
    const fromDict = needLookup.length > 0 ? await wordBankRepository.definitionsByWords(needLookup) : new Map<string, string>();

    const inputs: PromoteDefinitionInput[] = [];
    const missingDefinition: string[] = [];
    for (const item of input.items) {
      const definition = item.definition ?? fromDict.get(item.word.toLowerCase()) ?? '';
      if (definition.trim() === '') {
        missingDefinition.push(item.word);
        continue;
      }
      inputs.push({
        word: item.word,
        definition,
        rank: item.rank ?? input.defaultRank ?? 3,
        difficulty: item.difficulty ?? input.defaultDifficulty ?? 2,
        source: src,
      });
    }
    const res = await wordBankRepository.upsertDefinitions(inputs);
    return { upserted: res.upserted, total: input.items.length, missingDefinition };
  },
};
