import { env } from '../../env';
import { metrics } from '../observability';
import { now } from '@shared/time';
import type { AIRequest, ValidationRequest } from '../types';

// Async service seams (game-engine.md §5). A plugin emits REQUEST_VALIDATION / REQUEST_AI; the
// runtime calls these and feeds the result back as a synthetic action. The PLUGIN never awaits.
// Concrete payloads/logic are deliberately deferred (§10) — these are honest stubs that preserve
// the seam: rubric=Mongo, prompt-shell=env (only the env half is wired here).

export interface ServiceResult {
  ok: boolean;
  data: unknown;
}

// Word/category validation (Mongo dictionary + LLM fallback) — to be implemented when the
// validation service is built. Stub returns ok with the echoed payload so the loop is exercisable.
export const runValidation = async (payload: ValidationRequest): Promise<ServiceResult> => {
  const start = now();
  // TODO(validation-service): real dictionary lookup + LLM fallback with confidence threshold.
  const result: ServiceResult = { ok: true, data: payload };
  metrics.validationLatency(now() - start);
  return Promise.resolve(result);
};

// AI scoring/eval (OpenAI) for long free-text only. Prompt shell from env, rubric from Mongo
// (rubric wiring deferred). Stub is a no-op unless a key is configured.
export const runAI = async (payload: AIRequest): Promise<ServiceResult> => {
  const start = now();
  if (env.OPENAI_API_KEY === undefined) {
    metrics.aiLatency(now() - start);
    return { ok: false, data: { reason: 'ai_not_configured' } };
  }
  // TODO(ai-service): compose env.PLEAD_PROMPT_TEMPLATE + Mongo rubric, call OpenAI, parse rubric scores.
  const result: ServiceResult = { ok: true, data: payload };
  metrics.aiLatency(now() - start);
  return result;
};
