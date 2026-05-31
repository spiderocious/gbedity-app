import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { sessionStore } from '../services/session-store.ts';
import { CreateRoomResult } from '../types/api.ts';

// POST /rooms — host creates a room. Stores the host session (hostId/hostToken) so the
// socket can join as host and reclaim on refresh.
export function useCreateRoom() {
  return useMutation({
    mutationFn: async (nickname: string) => {
      const raw = await apiClient.post<unknown>('/rooms', { nickname });
      const data = CreateRoomResult.parse(raw);
      sessionStore.saveHost({ hostId: data.hostId, hostToken: data.hostToken, roomCode: data.code });
      sessionStore.saveNickname(nickname);
      return data;
    },
  });
}
