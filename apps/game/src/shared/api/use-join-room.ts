import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { sessionStore } from '../services/session-store.ts';
import { JoinRoomResult } from '../types/api.ts';

interface JoinArgs {
  readonly code: string;
  readonly nickname: string;
}

// POST /rooms/:code/players — player joins a lobby. Stores the reconnect token so a refresh
// reclaims the seat (PRD §11).
export function useJoinRoom() {
  return useMutation({
    mutationFn: async ({ code, nickname }: JoinArgs) => {
      const raw = await apiClient.post<unknown>(`/rooms/${code}/players`, { nickname });
      const data = JoinRoomResult.parse(raw);
      sessionStore.savePlayer({
        playerId: data.playerId,
        reconnectToken: data.reconnectToken,
        nickname,
        roomCode: data.code,
      });
      return data;
    },
  });
}
