import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from '../services/api-client.ts';
import { authStore } from '../services/auth-store.ts';
import { EP } from '../constants/endpoints.ts';

// All admin REST in one module — auth, content CRUD, metrics, game-plays, rubric. Thin
// wrappers over the documented endpoints (api-docs §Admin). No fetch in components.

interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export function useAdminLogin() {
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const data = await apiClient.post<Tokens>(EP.ADMIN_LOGIN, creds);
      authStore.setTokens(data.accessToken, data.refreshToken);
      return data;
    },
  });
}

export function useAdminSeed() {
  return useMutation({
    mutationFn: (email: string) => apiClient.post<{ email: string; password: string }>(EP.ADMIN_SEED, { email }),
  });
}

// Re-hydrate the in-memory access token from the stored refresh token (survives a reload /
// deep-link). Returns the auth state once the attempt settles, so the guard doesn't bounce a
// genuinely-logged-in admin to /login on refresh.
export const SessionState = { CHECKING: 'checking', AUTHED: 'authed', ANON: 'anon' } as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];

export function useAdminSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    authStore.getAccessToken() !== null ? SessionState.AUTHED : SessionState.CHECKING,
  );

  useEffect(() => {
    if (authStore.getAccessToken() !== null) {
      setState(SessionState.AUTHED);
      return undefined;
    }
    const refresh = authStore.getRefreshToken();
    if (refresh === null) {
      setState(SessionState.ANON);
      return undefined;
    }
    let cancelled = false;
    apiClient
      .post<Tokens>(EP.ADMIN_REFRESH, { refreshToken: refresh })
      .then((data) => {
        if (cancelled) return;
        authStore.setTokens(data.accessToken, data.refreshToken);
        setState(SessionState.AUTHED);
      })
      .catch(() => {
        if (cancelled) return;
        authStore.clear();
        setState(SessionState.ANON);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Content authoring hooks moved to features/content/api/content-api.ts (schema-driven, all 11 kinds).

// ---- Metrics + game-plays ----
export interface Metrics {
  readonly byGame: readonly { readonly gameId: string; readonly plays: number; readonly avgPlayers: number; readonly avgDurationMs: number }[];
}

export function useMetrics() {
  return useQuery({ queryKey: ['metrics'], queryFn: () => apiClient.get<Metrics>(EP.METRICS) });
}

// Game-play history hooks moved to features/history/api/history-api.ts (paginated + detail + events).

// ---- Rubric (Plead Your Case) ----
export interface Rubric {
  readonly key: string;
  readonly criteria: readonly { readonly key: string; readonly label: string; readonly weight: number }[];
}

export function useRubric() {
  return useQuery({ queryKey: ['rubric'], queryFn: () => apiClient.get<Rubric>(EP.RUBRIC) });
}

export function useSaveRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (criteria: Rubric['criteria']) => apiClient.put<{ ok: boolean }>(EP.RUBRIC, { criteria }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rubric'] }),
  });
}
