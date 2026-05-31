// Category-distance matrix, lifted verbatim from wordmaster (word-validation.service.ts `farOffs`).
// farOffs[wanted][found] grades how close a "right word, wrong category" answer is:
// 2 = very close (high overlap) → small deduction; 10 = far off → large deduction.
// Used by validation level 2 (graded partial credit). Unsealed per Q3.

export const FAR_OFFS: Record<string, Record<string, number>> = {
  name: { bible: 2, app: 3, car: 4, animal: 10, food: 8, country: 9, city: 4, company: 3, color: 10, currency: 10, disease: 9, language: 10 },
  bible: { name: 2, app: 8, car: 7, animal: 9, food: 9, country: 8, city: 6, company: 7, color: 10, currency: 10, disease: 10, language: 10 },
  app: { name: 3, bible: 8, car: 6, animal: 5, food: 4, country: 7, city: 6, company: 2, color: 6, currency: 8, disease: 10, language: 7 },
  car: { name: 4, bible: 7, app: 6, animal: 3, food: 8, country: 6, city: 5, company: 2, color: 4, currency: 10, disease: 10, language: 9 },
  animal: { name: 10, bible: 9, app: 5, car: 3, food: 2, country: 9, city: 8, company: 4, color: 6, currency: 10, disease: 7, language: 10 },
  food: { name: 8, bible: 9, app: 4, car: 8, animal: 2, country: 6, city: 5, company: 5, color: 3, currency: 10, disease: 10, language: 9 },
  country: { name: 9, bible: 8, app: 7, car: 6, animal: 9, food: 6, city: 4, company: 6, color: 8, currency: 4, disease: 8, language: 3 },
  city: { name: 4, bible: 6, app: 6, car: 5, animal: 8, food: 5, country: 4, company: 5, color: 7, currency: 8, disease: 9, language: 6 },
  company: { name: 3, bible: 7, app: 2, car: 2, animal: 4, food: 5, country: 6, city: 5, color: 6, currency: 9, disease: 10, language: 8 },
  color: { name: 10, bible: 10, app: 6, car: 4, animal: 6, food: 3, country: 8, city: 7, company: 6, currency: 10, disease: 10, language: 10 },
  currency: { name: 10, bible: 10, app: 8, car: 10, animal: 10, food: 10, country: 4, city: 8, company: 9, color: 10, disease: 10, language: 8 },
  disease: { name: 9, bible: 10, app: 10, car: 10, animal: 7, food: 10, country: 8, city: 9, company: 10, color: 10, currency: 10, language: 10 },
  language: { name: 10, bible: 10, app: 7, car: 9, animal: 10, food: 9, country: 3, city: 6, company: 8, color: 10, currency: 8, disease: 10 },
};

// Default distance for any pair not explicitly mapped (treat as far off).
export const DEFAULT_FAR_OFF = 10;
