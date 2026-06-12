import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { sessionStore } from '../services/session-store.ts';
import { JoinRoomResult } from '../types/api.ts';

interface JoinArgs {
  readonly code: string;
  readonly nickname: string;
  /** Opt in as a spectator: a real seat that watches but never plays (PRD §4/§10). */
  readonly spectator?: boolean;
}

// POST /rooms/:code/players — player joins a lobby. Stores the reconnect token so a refresh
// reclaims the seat (PRD §11). Spectators pass `spectator: true`; the server applies the
// "(SPECTATOR)" suffix + flags the seat.
export function useJoinRoom() {
  return useMutation({
    mutationFn: async ({ code, nickname, spectator }: JoinArgs) => {
      const raw = await apiClient.post<unknown>(`/rooms/${code}/players`, {
        nickname,
        ...(spectator === true ? { spectator: true } : {}),
      });
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
