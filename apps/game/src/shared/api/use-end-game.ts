import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { lobbyQueryKey } from './use-lobby.ts';

interface EndGameArgs {
  readonly code: string;
  readonly hostId: string;
}

// POST /rooms/:code/end-game — host ends the running game and returns the room to the lobby.
// Idempotent server-side (no running game → just confirms lobby). Invalidates the lobby query so
// the host's view (phase + activeGame) refreshes immediately.
export function useEndGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, hostId }: EndGameArgs) => {
      await apiClient.post<unknown>(`/rooms/${code}/end-game`, { hostId });
    },
    onSuccess: (_data, { code }) => {
      void queryClient.invalidateQueries({ queryKey: lobbyQueryKey(code) });
    },
  });
}
