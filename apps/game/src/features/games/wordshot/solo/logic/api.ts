import { z } from 'zod';

import { apiClient } from '../../../../../shared/services/api-client.ts';

// REST client for client-driven solo Wordshot. Mirrors the backend at /api/v1/solo/wordshot
// (see docs/specs/solo-games-playbook.md §5). Every response is Zod-parsed at the boundary —
// never trust the wire. apiClient unwraps the { data } envelope and throws ApiError on non-2xx.

const BASE = '/solo/wordshot';

// ── Response schemas (match ws-solo.service.ts return shapes exactly) ─────────
export const WsStartResult = z.object({
  soloId: z.string(),
  rounds: z.number(),
  config: z.object({
    rounds: z.number(),
    secondsPerRound: z.number(),
    letterDifficulty: z.string(),
    enabledCategories: z.array(z.string()),
  }),
});
export type WsStartResult = z.infer<typeof WsStartResult>;

export const WsRoundView = z.object({
  idx: z.number(),
  rounds: z.number(),
  letter: z.string(),
  category: z.string(),
  secondsPerRound: z.number(),
});
export type WsRoundView = z.infer<typeof WsRoundView>;

export const WsGuessResult = z.object({
  correct: z.boolean(),
  points: z.number(),
  totalScore: z.number(),
  idx: z.number(),
  rounds: z.number(),
  suggestion: z.string().optional(),
});
export type WsGuessResult = z.infer<typeof WsGuessResult>;

export const WsNextResult = z.object({
  done: z.boolean(),
  idx: z.number(),
  rounds: z.number(),
  totalScore: z.number(),
});
export type WsNextResult = z.infer<typeof WsNextResult>;

export const WsSnapshot = z.object({
  soloId: z.string(),
  idx: z.number(),
  rounds: z.number(),
  totalScore: z.number(),
  over: z.boolean(),
});
export type WsSnapshot = z.infer<typeof WsSnapshot>;

// ── Calls ─────────────────────────────────────────────────────────────────────
export const wsSoloApi = {
  async start(config?: Record<string, unknown>): Promise<WsStartResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/start`, config ? { config } : {});
    return WsStartResult.parse(raw);
  },
  async round(soloId: string): Promise<WsRoundView> {
    const raw = await apiClient.post<unknown>(`${BASE}/round`, { soloId });
    return WsRoundView.parse(raw);
  },
  async guess(soloId: string, text: string, elapsedMs: number, timeout = false): Promise<WsGuessResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/guess`, { soloId, text, elapsedMs, timeout });
    return WsGuessResult.parse(raw);
  },
  async next(soloId: string): Promise<WsNextResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/next`, { soloId });
    return WsNextResult.parse(raw);
  },
  async snapshot(soloId: string): Promise<WsSnapshot> {
    const raw = await apiClient.get<unknown>(`${BASE}/${soloId}`);
    return WsSnapshot.parse(raw);
  },
};
