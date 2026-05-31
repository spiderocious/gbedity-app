import { useMutation } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { StartGameResult } from '../types/api.ts';

interface StartGameArgs {
  readonly code: string;
  readonly hostId: string;
  readonly gameId: string;
  readonly config?: Record<string, unknown>;
}

// POST /rooms/:code/start — host starts a single game. Content resolves server-side; we send
// only the documented config fields (see config-map). Backend may reject configs that exceed
// seeded content (integration-plan §8 B3), surfaced as a coded ApiError.
export function useStartGame() {
  return useMutation({
    mutationFn: async ({ code, hostId, gameId, config }: StartGameArgs) => {
      const body: Record<string, unknown> = { hostId, gameId };
      if (config !== undefined && Object.keys(config).length > 0) body.config = config;
      const raw = await apiClient.post<unknown>(`/rooms/${code}/start`, body);
      return StartGameResult.parse(raw);
    },
  });
}
