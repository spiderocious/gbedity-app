import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';

// One game as published to the room — the slim, public summary players/display see. Mirrors the
// backend LineupEntry/LineupFact shape (the seam): { gameId, title, facts:[{label,value}] }.
export interface PublishLineupFact {
  readonly label: string;
  readonly value: string;
}

export interface PublishLineupEntry {
  readonly gameId: string;
  readonly title: string;
  readonly facts: readonly PublishLineupFact[];
}

interface SetLineupArgs {
  readonly code: string;
  readonly hostId: string;
  readonly lineup: readonly PublishLineupEntry[];
}

// PUT /rooms/:code/lineup — host publishes its current lineup so players + display can see it in
// the lobby. Host mirrors its local queue here; the server replaces the whole lineup each call.
export function useSetLineup() {
  return useMutation({
    mutationFn: async ({ code, hostId, lineup }: SetLineupArgs) => {
      await apiClient.put<unknown>(`/rooms/${code}/lineup`, { hostId, lineup });
    },
  });
}
