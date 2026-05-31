import { setValidationProvider, type ServiceResult } from '@engine/services/service-seams';
import type { ValidationRequest } from '@engine/types';

import { DupHandling, validationService, type ValidateWordInput } from './validation.service';

// Adapts the abstract engine REQUEST_VALIDATION payload to the real validation service. Installed
// at bootstrap so the engine stays free of @features imports (layering). The payload's `mode`
// selects which validation the game wants — defaults to word validation (Wordshot/Word Bomb).

const ValidationMode = {
  WORD: 'word',
  RELATION: 'relation', // synonyms / antonyms
  DEFINITION: 'definition', // definition race
} as const;

const isDup = (v: unknown): v is DupHandling =>
  v === DupHandling.STRICT || v === DupHandling.RELAXED || v === DupHandling.SYNONYM;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []);

export const installValidationProvider = (): void => {
  setValidationProvider(async (payload: ValidationRequest): Promise<ServiceResult> => {
    const mode = payload.mode;

    if (mode === ValidationMode.RELATION) {
      const relation = payload.relation === 'antonyms' ? 'antonyms' : 'synonyms';
      const verdict = await validationService.validateRelation({
        promptWord: str(payload.promptWord),
        guess: str(payload.guess),
        relation,
        used: strArr(payload.used),
      });
      return { ok: verdict.valid, data: verdict };
    }

    if (mode === ValidationMode.DEFINITION) {
      const verdict = await validationService.validateDefinitionAnswer({
        answerWord: str(payload.answerWord),
        guess: str(payload.guess),
      });
      return { ok: verdict.correct, data: verdict };
    }

    // default: word validation (Wordshot / Word Bomb)
    const input: ValidateWordInput = {
      word: str(payload.word),
      dupHandling: isDup(payload.dupHandling) ? payload.dupHandling : DupHandling.STRICT,
      ...(typeof payload.category === 'string' && { category: payload.category }),
      ...(typeof payload.startsWith === 'string' && { startsWith: payload.startsWith }),
      ...(Array.isArray(payload.used) && { used: strArr(payload.used) }),
    };
    const verdict = await validationService.validateWord(input);
    return { ok: verdict.valid, data: verdict };
  });
};
