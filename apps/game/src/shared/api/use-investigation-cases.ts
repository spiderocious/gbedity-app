import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '../services/api-client.ts';

// The investigation case catalogue for the host's case picker (no spoilers — title/category/
// difficulty/suspect count). Served by GET /solo/investigation/cases (unauthenticated, rating-
// filtered server-side). Used by both the solo and multiplayer configure flows.

export const InvestigationCaseSummary = z.object({
  key: z.string(),
  title: z.string(),
  category: z.string(),
  difficulty: z.number(),
  suspectCount: z.number(),
});
export type InvestigationCaseSummary = z.infer<typeof InvestigationCaseSummary>;

const CasesResult = z.object({ cases: z.array(InvestigationCaseSummary) });

export const investigationCasesQueryKey = ['investigation', 'cases'] as const;

export function useInvestigationCases() {
  return useQuery({
    queryKey: investigationCasesQueryKey,
    queryFn: async () => {
      const raw = await apiClient.get<unknown>('/solo/investigation/cases');
      return CasesResult.parse(raw).cases;
    },
    staleTime: 5 * 60 * 1000,
  });
}
