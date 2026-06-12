import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';

interface SpectateArgs {
  readonly code: string;
  readonly playerId: string;
}

// POST /rooms/:code/spectate — convert the caller's EXISTING seat to a spectator in place (no new
// seat; the server flips the flag + applies the "(SPECTATOR)" suffix). The seat/reconnect token is
// unchanged, so the existing socket stays bound — the gateway just re-routes it on its next join.
export function useSpectate() {
  return useMutation({
    mutationFn: async ({ code, playerId }: SpectateArgs) => {
      await apiClient.post<unknown>(`/rooms/${code}/spectate`, { playerId });
    },
  });
}
