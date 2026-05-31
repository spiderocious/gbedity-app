import { setValidationProvider, type ServiceResult } from '@engine/services/service-seams';
import type { ValidationRequest } from '@engine/types';

import { DupHandling, validationService, type ValidateWordInput } from './validation.service';

// Adapts the abstract engine REQUEST_VALIDATION payload to the real validation service. Installed
// at bootstrap so the engine stays free of @features imports (layering).

const isDup = (v: unknown): v is DupHandling =>
  v === DupHandling.STRICT || v === DupHandling.RELAXED || v === DupHandling.SYNONYM;

export const installValidationProvider = (): void => {
  setValidationProvider(async (payload: ValidationRequest): Promise<ServiceResult> => {
    const word = typeof payload.word === 'string' ? payload.word : '';
    const input: ValidateWordInput = {
      word,
      dupHandling: isDup(payload.dupHandling) ? payload.dupHandling : DupHandling.STRICT,
      ...(typeof payload.category === 'string' && { category: payload.category }),
      ...(typeof payload.startsWith === 'string' && { startsWith: payload.startsWith }),
      ...(Array.isArray(payload.used) && { used: payload.used.filter((u): u is string => typeof u === 'string') }),
    };
    const verdict = await validationService.validateWord(input);
    return { ok: verdict.valid, data: verdict };
  });
};
