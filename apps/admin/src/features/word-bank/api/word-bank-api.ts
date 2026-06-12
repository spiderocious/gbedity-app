import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, buildQuery, type Page } from '../../../shared/services/api-client.ts';
import { EP } from '../../../shared/constants/endpoints.ts';

// Word bank — browse the reference collections (dictionary/allwords/words), promote rows into the
// operational sets (game_words / game_definitions), and manage rank/difficulty.

export const ReferenceSource = { DICTIONARY: 'dictionary', ALLWORDS: 'allwords', WORDS: 'words' } as const;
export type ReferenceSource = (typeof ReferenceSource)[keyof typeof ReferenceSource];

export interface ReferenceRow {
  readonly word: string;
  readonly definition?: string;
  readonly promotedAsWord: boolean;
  readonly promotedAsDefinition: boolean;
}

export interface GameWord {
  readonly id: string;
  readonly word: string;
  readonly startsWith: string;
  readonly length: number;
  readonly rank: number;
  readonly difficulty: number;
  readonly source: string;
}

export interface GameDefinition {
  readonly id: string;
  readonly word: string;
  readonly definition: string;
  readonly length: number;
  readonly rank: number;
  readonly difficulty: number;
  readonly source: string;
}

export interface PromoteResult {
  readonly upserted: number;
  readonly total: number;
  readonly missingDefinition?: readonly string[];
}

export interface PromoteWordItem {
  readonly word: string;
  readonly rank?: number;
  readonly difficulty?: number;
}
export interface PromoteDefinitionItem {
  readonly word: string;
  readonly definition?: string;
  readonly rank?: number;
  readonly difficulty?: number;
}

// ── Reference browse ──────────────────────────────────────────────────────────
export function useReferenceWords(source: ReferenceSource, opts: { search?: string; cursor?: string }) {
  return useQuery<Page<ReferenceRow>>({
    queryKey: ['word-source', source, opts.search ?? '', opts.cursor ?? 'first'],
    queryFn: () => apiClient.getPage<ReferenceRow>(EP.WORD_SOURCE(source) + buildQuery({ limit: 50, search: opts.search, cursor: opts.cursor })),
  });
}

// ── game_words ────────────────────────────────────────────────────────────────
export function useGameWords(opts: { search?: string; cursor?: string }) {
  return useQuery<Page<GameWord>>({
    queryKey: ['game-words', opts.search ?? '', opts.cursor ?? 'first'],
    queryFn: () => apiClient.getPage<GameWord>(EP.GAME_WORDS + buildQuery({ limit: 50, search: opts.search, cursor: opts.cursor })),
  });
}

export function usePromoteWords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: readonly PromoteWordItem[]; source?: ReferenceSource; defaultRank?: number; defaultDifficulty?: number }) =>
      apiClient.post<PromoteResult>(EP.GAME_WORDS_PROMOTE, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game-words'] });
      void qc.invalidateQueries({ queryKey: ['word-source'] });
    },
  });
}

export function useUpdateGameWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { rank?: number; difficulty?: number } }) => apiClient.patch<GameWord>(EP.GAME_WORD(id), patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['game-words'] }),
  });
}

export function useDeleteGameWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(EP.GAME_WORD(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game-words'] });
      void qc.invalidateQueries({ queryKey: ['word-source'] });
    },
  });
}

// ── game_definitions ──────────────────────────────────────────────────────────
export function useGameDefinitions(opts: { search?: string; cursor?: string }) {
  return useQuery<Page<GameDefinition>>({
    queryKey: ['game-definitions', opts.search ?? '', opts.cursor ?? 'first'],
    queryFn: () => apiClient.getPage<GameDefinition>(EP.GAME_DEFINITIONS + buildQuery({ limit: 50, search: opts.search, cursor: opts.cursor })),
  });
}

export function usePromoteDefinitions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: readonly PromoteDefinitionItem[]; source?: ReferenceSource; defaultRank?: number; defaultDifficulty?: number }) =>
      apiClient.post<PromoteResult>(EP.GAME_DEFINITIONS_PROMOTE, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game-definitions'] });
      void qc.invalidateQueries({ queryKey: ['word-source'] });
    },
  });
}

export function useUpdateGameDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { rank?: number; difficulty?: number; definition?: string } }) =>
      apiClient.patch<GameDefinition>(EP.GAME_DEFINITION(id), patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['game-definitions'] }),
  });
}

export function useDeleteGameDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(EP.GAME_DEFINITION(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game-definitions'] });
      void qc.invalidateQueries({ queryKey: ['word-source'] });
    },
  });
}
