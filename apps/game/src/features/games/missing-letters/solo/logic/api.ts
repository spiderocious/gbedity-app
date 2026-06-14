import { z } from 'zod';

import { apiClient } from '../../../../../shared/services/api-client.ts';

// REST client for client-driven solo Missing Letters. Mirrors the backend at
// /api/v1/solo/missing-letters (see docs/specs/solo-games-playbook.md §5). The CLIENT owns pacing —
// these are plain request/response calls, no socket. Every response is Zod-parsed at the boundary
// (never trust the wire). apiClient unwraps the { data } envelope and throws ApiError on non-2xx.

const BASE = '/solo/missing-letters';

// ── Response schemas (match the backend service return shapes exactly) ──────────
export const MlStartResult = z.object({
  soloId: z.string(),
  rounds: z.number(),
  config: z.object({
    rounds: z.number(),
    secondsPerRound: z.number(),
    hiddenCount: z.number(),
    minLen: z.number(),
    maxLen: z.number(),
  }),
});
export type MlStartResult = z.infer<typeof MlStartResult>;

export const MlRoundView = z.object({
  idx: z.number(),
  rounds: z.number(),
  masked: z.string(),
  length: z.number(),
  secondsPerRound: z.number(),
});
export type MlRoundView = z.infer<typeof MlRoundView>;

export const MlGuessResult = z.object({
  correct: z.boolean(),
  points: z.number(),
  answer: z.string(),
  totalScore: z.number(),
  idx: z.number(),
  rounds: z.number(),
});
export type MlGuessResult = z.infer<typeof MlGuessResult>;

export const MlNextResult = z.object({
  done: z.boolean(),
  idx: z.number(),
  rounds: z.number(),
  totalScore: z.number(),
});
export type MlNextResult = z.infer<typeof MlNextResult>;

export const MlSnapshot = z.object({
  soloId: z.string(),
  idx: z.number(),
  rounds: z.number(),
  totalScore: z.number(),
  over: z.boolean(),
});
export type MlSnapshot = z.infer<typeof MlSnapshot>;

// ── Calls ─────────────────────────────────────────────────────────────────────
export const mlSoloApi = {
  async start(config?: Record<string, unknown>): Promise<MlStartResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/start`, config ? { config } : {});
    return MlStartResult.parse(raw);
  },
  async round(soloId: string): Promise<MlRoundView> {
    const raw = await apiClient.post<unknown>(`${BASE}/round`, { soloId });
    return MlRoundView.parse(raw);
  },
  async guess(soloId: string, text: string, elapsedMs: number, timeout = false): Promise<MlGuessResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/guess`, { soloId, text, elapsedMs, timeout });
    return MlGuessResult.parse(raw);
  },
  async next(soloId: string): Promise<MlNextResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/next`, { soloId });
    return MlNextResult.parse(raw);
  },
  async snapshot(soloId: string): Promise<MlSnapshot> {
    const raw = await apiClient.get<unknown>(`${BASE}/${soloId}`);
    return MlSnapshot.parse(raw);
  },
};
