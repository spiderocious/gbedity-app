import { registerContentResolver, type ResolveInput } from '@engine/content-resolver';
import { GameId } from '@engine/constants';
import { contentService } from '@features/content/content.service';

interface TODConfig {
  rounds: number;
}

export const installTruthOrDareContent = (): void => {
  registerContentResolver(GameId.TRUTH_OR_DARE, async (input: ResolveInput): Promise<unknown> => {
    const config = input.config as TODConfig;
    const sample = Math.max(5, config.rounds * 4);
    const [truths, dares] = await Promise.all([
      contentService.resolveTruthOrDare({ kind: 'truth', filter: input.ratingFilter, sample }),
      contentService.resolveTruthOrDare({ kind: 'dare', filter: input.ratingFilter, sample }),
    ]);
    return {
      truths: truths.length > 0 ? truths : ['What is a secret talent you have?'],
      dares: dares.length > 0 ? dares : ['Do your best dance move for 10 seconds.'],
    };
  });
};
