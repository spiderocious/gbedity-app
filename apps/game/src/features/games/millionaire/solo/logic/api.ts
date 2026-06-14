import { z } from 'zod';

import { apiClient } from '../../../../../shared/services/api-client.ts';

// REST client for client-driven solo WWTBAM. Mirrors the backend at /api/v1/solo/millionaire.
// The CLIENT owns pacing — plain request/response, no socket. Every response is Zod-parsed at the
// boundary (never trust the wire). apiClient unwraps the { data } envelope and throws ApiError on
// non-2xx.

const BASE = '/solo/millionaire';

// ── Response schemas (match the backend service return shapes exactly) ──────────
export const WwtbamStartResult = z.object({
  soloId: z.string(),
  questionCount: z.number(),
  config: z.object({
    questionCount: z.number(),
    secondsPerQuestion: z.number(),
    category: z.string(),
  }),
  ladder: z.array(z.number()),
});
export type WwtbamStartResult = z.infer<typeof WwtbamStartResult>;

export const WwtbamQuestionView = z.object({
  idx: z.number(),
  questionCount: z.number(),
  prompt: z.string(),
  options: z.array(z.string()),
  rung: z.number(),
  secondsPerQuestion: z.number(),
  fiftyFiftyAvailable: z.boolean(),
});
export type WwtbamQuestionView = z.infer<typeof WwtbamQuestionView>;

export const WwtbamAnswerResult = z.object({
  correct: z.boolean(),
  answerIdx: z.number(),
  rung: z.number(),
  bankedThisQuestion: z.number(),
  totalBanked: z.number(),
  idx: z.number(),
  questionCount: z.number(),
  eliminated: z.boolean(),
});
export type WwtbamAnswerResult = z.infer<typeof WwtbamAnswerResult>;

export const WwtbamNextResult = z.object({
  done: z.boolean(),
  idx: z.number(),
  questionCount: z.number(),
  totalBanked: z.number(),
  eliminated: z.boolean(),
});
export type WwtbamNextResult = z.infer<typeof WwtbamNextResult>;

export const WwtbamFiftyFiftyResult = z.object({
  hidden: z.tuple([z.number(), z.number()]),
});
export type WwtbamFiftyFiftyResult = z.infer<typeof WwtbamFiftyFiftyResult>;

export const WwtbamSnapshot = z.object({
  soloId: z.string(),
  idx: z.number(),
  questionCount: z.number(),
  totalBanked: z.number(),
  over: z.boolean(),
  eliminated: z.boolean(),
});
export type WwtbamSnapshot = z.infer<typeof WwtbamSnapshot>;

// ── Calls ─────────────────────────────────────────────────────────────────────
export const wwtbamSoloApi = {
  async start(config?: Record<string, unknown>): Promise<WwtbamStartResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/start`, config ? { config } : {});
    return WwtbamStartResult.parse(raw);
  },
  async question(soloId: string): Promise<WwtbamQuestionView> {
    const raw = await apiClient.post<unknown>(`${BASE}/question`, { soloId });
    return WwtbamQuestionView.parse(raw);
  },
  async answer(soloId: string, choiceIdx: number, timeout = false): Promise<WwtbamAnswerResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/answer`, { soloId, choiceIdx, timeout });
    return WwtbamAnswerResult.parse(raw);
  },
  async next(soloId: string): Promise<WwtbamNextResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/next`, { soloId });
    return WwtbamNextResult.parse(raw);
  },
  async fiftyFifty(soloId: string): Promise<WwtbamFiftyFiftyResult> {
    const raw = await apiClient.post<unknown>(`${BASE}/fifty-fifty`, { soloId });
    return WwtbamFiftyFiftyResult.parse(raw);
  },
  async snapshot(soloId: string): Promise<WwtbamSnapshot> {
    const raw = await apiClient.get<unknown>(`${BASE}/${soloId}`);
    return WwtbamSnapshot.parse(raw);
  },
};
