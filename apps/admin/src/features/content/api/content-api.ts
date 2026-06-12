import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, buildQuery, type Page } from '../../../shared/services/api-client.ts';
import { EP } from '../../../shared/constants/endpoints.ts';
import type { KIND_DESCRIPTORS } from '../schema/content-kinds.ts';

// Content authoring — full CRUD per kind (api-docs §Content). All 11 kinds are driven by the
// schema descriptors; this layer is the thin REST wrapper. List is cursor-paginated.

// The kind ids, sourced from the descriptors so the UI and the form schema can never disagree.
export type ContentKind = (typeof KIND_DESCRIPTORS)[number]['kind'];

export interface ContentDoc {
  readonly id?: string;
  readonly [key: string]: unknown;
}

// Per-row bulk result the backend returns for /bulk.
export interface BulkResult {
  readonly inserted: number;
  readonly failed: number;
  readonly total: number;
  readonly errors: readonly { readonly index: number; readonly field_errors?: Record<string, string[]> }[];
}

export const contentQueryKey = (kind: string) => ['content', kind] as const;

export function useContentList(kind: ContentKind, cursor?: string) {
  return useQuery<Page<ContentDoc>>({
    queryKey: [...contentQueryKey(kind), cursor ?? 'first'],
    queryFn: () => apiClient.getPage<ContentDoc>(EP.CONTENT(kind) + buildQuery({ limit: 20, cursor })),
  });
}

export function useContentItem(kind: ContentKind, id: string | undefined) {
  return useQuery<ContentDoc>({
    queryKey: [...contentQueryKey(kind), 'item', id],
    queryFn: () => apiClient.get<ContentDoc>(EP.CONTENT_ITEM(kind, id as string)),
    enabled: id !== undefined,
  });
}

export function useCreateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: Record<string, unknown>) => apiClient.post<ContentDoc>(EP.CONTENT(kind), doc),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}

export function useUpdateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiClient.patch<ContentDoc>(EP.CONTENT_ITEM(kind, id), patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}

export function useBulkCreateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: readonly Record<string, unknown>[]) => apiClient.post<BulkResult>(EP.CONTENT_BULK(kind), { items }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}

export function useDeleteContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(EP.CONTENT_ITEM(kind, id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentQueryKey(kind) }),
  });
}
