import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { sessionStore } from '../services/session-store.ts';
import { StartSoloResult } from '../types/api.ts';

interface StartSoloArgs {
  readonly gameId: string;
  readonly nickname?: string;
  readonly config?: Record<string, unknown>;
}

// POST /solo/start — start a single-player game. The backend mints an ephemeral room, returns its
// code as `soloId`, and pipes all three audiences (host/player/display) to the one player socket.
// We save a player session (soloId as room code) so the in-game player surface joins as PLAYER and
// can reclaim its seat on refresh — exactly like a multiplayer player. Content resolves server-side;
// we send only the documented config fields (config-map), omitting an empty config.
export function useStartSolo() {
  return useMutation({
    mutationFn: async ({ gameId, nickname, config }: StartSoloArgs) => {
      const name = nickname?.trim() ?? '';
      const body: Record<string, unknown> = { gameId };
      if (name !== '') body.nickname = name;
      if (config !== undefined && Object.keys(config).length > 0) body.config = config;

      const raw = await apiClient.post<unknown>('/solo/start', body);
      const data = StartSoloResult.parse(raw);

      sessionStore.savePlayer({
        playerId: data.playerId,
        reconnectToken: data.reconnectToken,
        nickname: name === '' ? 'You' : name,
        roomCode: data.soloId,
      });
      return data;
    },
  });
}
