import { setAIProvider, type ServiceResult } from '@engine/services/service-seams';
import type { AIRequest } from '@engine/types';

import { aiService, type RubricCriterion } from './ai.service';

// Adapts the engine REQUEST_AI payload to the AI service (Plead Your Case scoring). Installed at
// bootstrap (engine never imports @features). One retry on failure (Q5); a still-failed call
// returns ok:false → the plugin renders "evaluation failed".

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const installAIProvider = (): void => {
  setAIProvider(async (payload: AIRequest): Promise<ServiceResult> => {
    const input = {
      charge: str(payload.charge),
      defendant: str(payload.defendant),
      facts: str(payload.facts),
      laws: str(payload.laws),
      precedents: str(payload.precedents),
      argument: str(payload.argument),
      criteria: Array.isArray(payload.criteria) ? (payload.criteria as RubricCriterion[]) : [],
    };

    let result = await aiService.scorePlea(input);
    if (!result.ok) result = await aiService.scorePlea(input); // retry once (Q5)

    return { ok: result.ok, data: result };
  });
};
