import { useQuery } from '@tanstack/react-query';

import { apiClient, buildQuery, type Page } from '../../../shared/services/api-client.ts';
import { EP } from '../../../shared/constants/endpoints.ts';

// Game-play history + session event replay (api-docs §game-plays / §sessions). A play's `id` IS
// the game-instance id, so the event stream for a play is fetched with that same id.

export interface GamePlayPlayer {
  readonly id: string;
  readonly nickname: string;
}

export interface GamePlayScore {
  readonly playerId: string;
  readonly points: number;
}

export interface GamePlay {
  readonly id: string;
  readonly roomCode: string;
  readonly gameId: string;
  readonly players: readonly GamePlayPlayer[];
  readonly finalBoard: readonly GamePlayScore[];
  readonly startedAt: number;
  readonly endedAt: number;
  readonly createdAt: number;
}

export interface SessionEvent {
  readonly instanceId: string;
  readonly roomCode: string;
  readonly seq: number;
  readonly at: number;
  readonly type: string;
  readonly data: Record<string, unknown>;
}

export const historyQueryKey = ['game-plays'] as const;

export function useGamePlays(opts: { gameId?: string; cursor?: string }) {
  return useQuery<Page<GamePlay>>({
    queryKey: [...historyQueryKey, opts.gameId ?? 'all', opts.cursor ?? 'first'],
    queryFn: () => apiClient.getPage<GamePlay>(EP.GAME_PLAYS + buildQuery({ limit: 20, gameId: opts.gameId, cursor: opts.cursor })),
  });
}

export function useGamePlay(id: string | undefined) {
  return useQuery<GamePlay>({
    queryKey: [...historyQueryKey, 'detail', id],
    queryFn: () => apiClient.get<GamePlay>(EP.GAME_PLAY(id as string)),
    enabled: id !== undefined,
  });
}

export function useSessionEvents(instanceId: string | undefined) {
  return useQuery<SessionEvent[]>({
    queryKey: ['session-events', instanceId],
    queryFn: () => apiClient.get<SessionEvent[]>(EP.SESSION_EVENTS(instanceId as string)),
    enabled: instanceId !== undefined,
  });
}
