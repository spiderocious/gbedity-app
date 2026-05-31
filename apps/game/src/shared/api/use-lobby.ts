import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { LobbySnapshot } from '../types/api.ts';

export const lobbyQueryKey = (code: string) => ['lobby', code] as const;

// GET /rooms/:code — lobby snapshot. The roster renders from this; the backend has no lobby
// view-patch, so we poll while the room is in the lobby phase so players appear as they join
// (BUG-04). Polling stops once `poll` is false (e.g. the game has started — phase change).
export function useLobby(code: string, enabled = true, poll = true) {
  return useQuery({
    queryKey: lobbyQueryKey(code),
    enabled: enabled && code !== '',
    staleTime: 1000,
    // Poll every 2.5s while in the lobby so the roster live-updates without a manual reload.
    refetchInterval: poll ? 2500 : false,
    queryFn: async () => {
      const raw = await apiClient.get<unknown>(`/rooms/${code}`);
      return LobbySnapshot.parse(raw);
    },
  });
}
