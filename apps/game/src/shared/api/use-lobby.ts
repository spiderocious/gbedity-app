import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { LobbySnapshot } from '../types/api.ts';

export const lobbyQueryKey = (code: string) => ['lobby', code] as const;

// GET /rooms/:code — lobby snapshot. Seeds the lobby UI before the socket takes over with
// live player joins. Short staleTime; the socket is the live source.
export function useLobby(code: string, enabled = true) {
  return useQuery({
    queryKey: lobbyQueryKey(code),
    enabled: enabled && code !== '',
    staleTime: 2000,
    queryFn: async () => {
      const raw = await apiClient.get<unknown>(`/rooms/${code}`);
      return LobbySnapshot.parse(raw);
    },
  });
}
