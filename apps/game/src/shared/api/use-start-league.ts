import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { LeagueStandings, StartLeagueResult } from '../types/api.ts';

export interface LeagueQueueItem {
  readonly gameId: string;
  readonly config?: Record<string, unknown>;
  readonly weight?: 1 | 2 | 3;
}

interface StartLeagueArgs {
  readonly code: string;
  readonly hostId: string;
  readonly aggregate?: 'sum' | 'average' | 'top_3';
  readonly queue: readonly LeagueQueueItem[];
}

// POST /rooms/:code/league — start a multi-game league.
export function useStartLeague() {
  return useMutation({
    mutationFn: async ({ code, hostId, aggregate, queue }: StartLeagueArgs) => {
      const body: Record<string, unknown> = { hostId, queue };
      if (aggregate !== undefined) body.aggregate = aggregate;
      const raw = await apiClient.post<unknown>(`/rooms/${code}/league`, body);
      return StartLeagueResult.parse(raw);
    },
  });
}

export const standingsQueryKey = (code: string) => ['league-standings', code] as const;

// GET /rooms/:code/league/standings — cross-game aggregate.
export function useLeagueStandings(code: string, enabled = true) {
  return useQuery({
    queryKey: standingsQueryKey(code),
    enabled: enabled && code !== '',
    queryFn: async () => {
      const raw = await apiClient.get<unknown>(`/rooms/${code}/league/standings`);
      return LeagueStandings.parse(raw);
    },
  });
}
