import { metrics } from '../observability';
import { now } from '@shared/time';
import type { AIRequest, ValidationRequest } from '../types';

// Async service seams (game-engine.md §5). A plugin emits REQUEST_VALIDATION / REQUEST_AI; the
// runtime calls these and feeds the result back as a synthetic action. The PLUGIN never awaits.
//
// Layering: the engine must not import @features. So the seam holds INJECTED providers — the app
// bootstrap (or a test) installs the real validation/AI implementations via setValidationProvider /
// setAIProvider. Until installed, a provider is a safe no-op (ok:false) so the engine still runs.

export interface ServiceResult {
  ok: boolean;
  data: unknown;
}

export type ServiceProvider<T> = (payload: T) => Promise<ServiceResult>;

const noopProvider: ServiceProvider<unknown> = async () =>
  Promise.resolve({ ok: false, data: { reason: 'provider_not_installed' } });

let validationProvider: ServiceProvider<ValidationRequest> = noopProvider;
let aiProvider: ServiceProvider<AIRequest> = noopProvider;

export const setValidationProvider = (p: ServiceProvider<ValidationRequest>): void => {
  validationProvider = p;
};
export const setAIProvider = (p: ServiceProvider<AIRequest>): void => {
  aiProvider = p;
};

export const runValidation = async (payload: ValidationRequest): Promise<ServiceResult> => {
  const start = now();
  const result = await validationProvider(payload);
  metrics.validationLatency(now() - start);
  return result;
};

export const runAI = async (payload: AIRequest): Promise<ServiceResult> => {
  const start = now();
  const result = await aiProvider(payload);
  metrics.aiLatency(now() - start);
  return result;
};
