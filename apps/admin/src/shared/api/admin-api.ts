import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { authStore } from '../services/auth-store.ts';

// All admin REST in one module — auth, content CRUD, metrics, game-plays, rubric. Thin
// wrappers over the documented endpoints (api-docs §Admin). No fetch in components.

interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export function useAdminLogin() {
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const data = await apiClient.post<Tokens>('/admin/login', creds);
      authStore.setTokens(data.accessToken, data.refreshToken);
      return data;
    },
  });
}

export function useAdminSeed() {
  return useMutation({
    mutationFn: (email: string) => apiClient.post<{ email: string; password: string }>('/admin/seed', { email }),
  });
}

// ---- Content kinds (api-docs §Content authoring) ----
export const ContentKind = {
  QUIZ_DECK: 'quiz_deck',
  WORD: 'word',
  HOT_TAKE_PROMPT: 'hot_take_prompt',
  PLEAD_SCENARIO: 'plead_scenario',
} as const;
export type ContentKind = (typeof ContentKind)[keyof typeof ContentKind];

export interface ContentDoc {
  readonly id?: string;
  readonly [key: string]: unknown;
}

export const contentQueryKey = (kind: string) => ['content', kind] as const;

export function useContentList(kind: ContentKind) {
  return useQuery({
    queryKey: contentQueryKey(kind),
    queryFn: () => apiClient.get<ContentDoc[]>(`/admin/content/${kind}`),
  });
}

export function useCreateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: ContentDoc) => apiClient.post<ContentDoc>(`/admin/content/${kind}`, doc),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}

export function useDeleteContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/admin/content/${kind}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}

// ---- Metrics + game-plays ----
export interface Metrics {
  readonly byGame: readonly { readonly gameId: string; readonly plays: number; readonly avgPlayers: number; readonly avgDurationMs: number }[];
}

export function useMetrics() {
  return useQuery({ queryKey: ['metrics'], queryFn: () => apiClient.get<Metrics>('/admin/metrics') });
}

export interface GamePlay {
  readonly id: string;
  readonly roomCode: string;
  readonly gameId: string;
  readonly players: readonly { readonly id: string; readonly nickname: string }[];
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export function useGamePlays() {
  return useQuery({
    queryKey: ['game-plays'],
    queryFn: () => apiClient.get<{ data?: GamePlay[] } | GamePlay[]>('/admin/game-plays').then((r) => (Array.isArray(r) ? r : (r.data ?? []))),
  });
}

// ---- Rubric (Plead Your Case) ----
export interface Rubric {
  readonly key: string;
  readonly criteria: readonly { readonly key: string; readonly label: string; readonly weight: number }[];
}

export function useRubric() {
  return useQuery({ queryKey: ['rubric'], queryFn: () => apiClient.get<Rubric>('/admin/rubric') });
}

export function useSaveRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (criteria: Rubric['criteria']) => apiClient.put<{ ok: boolean }>('/admin/rubric', { criteria }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rubric'] }),
  });
}
