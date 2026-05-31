import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface PleadConfig {
  rounds: number;
}

export const installPleadContent = (): void => {
  registerContentResolver(GameId.PLEAD_YOUR_CASE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as PleadConfig;
    const [scenarios, rubric] = await Promise.all([
      contentService.resolvePleadScenarios({ filter: input.ratingFilter, sample: Math.max(1, config.rounds) }),
      contentService.pleadRubric(),
    ]);
    return {
      scenarios: scenarios.map((s) => ({
        charge: s.charge,
        defendant: s.defendant,
        facts: s.facts,
        laws: s.laws,
        precedents: s.precedents,
      })),
      rubric: rubric.criteria,
    };
  });
};
