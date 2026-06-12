import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../../../shared/services/api-client.ts';
import { EP } from '../../../shared/constants/endpoints.ts';

// Catalogue authoring + curation (api-docs §Admin catalogue). The list joins every eligible
// (registered, mappable) plugin to its entry; the admin authors presentation + activates.

export const CatalogueStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;
export type CatalogueStatus = (typeof CatalogueStatus)[keyof typeof CatalogueStatus];

export interface CatalogueEntry {
  readonly id: string;
  readonly gameId: string;
  readonly status: CatalogueStatus;
  readonly description: string;
  readonly estMinutes: number;
  readonly iconName: string;
  readonly playersMinOverride?: number;
  readonly playersMaxOverride?: number | null;
  readonly sortOrder: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

// One row per eligible game (AdminCatalogueRow at the seam): the live manifest fields are the
// source of truth; `entry` is the admin-authored presentation (null until first created).
export interface CatalogueRow {
  readonly gameId: string;
  readonly hasEntry: boolean;
  readonly eligible: boolean;
  readonly status: CatalogueStatus | null;
  readonly title: string | null;
  readonly category: string | null;
  readonly mode: string | null;
  readonly manifestPlayers: { readonly min: number; readonly max: number | null; readonly recommendedMax: number } | null;
  readonly entry: CatalogueEntry | null;
}

// The presentation fields the admin authors. gameId is the immutable join key (path param on PATCH).
export interface CatalogueUpsert {
  readonly description: string;
  readonly estMinutes: number;
  readonly iconName: string;
  readonly playersMinOverride?: number;
  readonly playersMaxOverride?: number | null;
  readonly sortOrder?: number;
}

const catalogueQueryKey = ['catalogue'] as const;

export function useCatalogue() {
  return useQuery({
    queryKey: catalogueQueryKey,
    queryFn: () => apiClient.get<CatalogueRow[]>(EP.CATALOGUE),
  });
}

export function useCreateCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CatalogueUpsert & { gameId: string }) => apiClient.post<CatalogueEntry>(EP.CATALOGUE, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogueQueryKey }),
  });
}

export function useUpdateCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, patch }: { gameId: string; patch: Partial<CatalogueUpsert> }) =>
      apiClient.patch<CatalogueEntry>(EP.CATALOGUE_ENTRY(gameId), patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogueQueryKey }),
  });
}

export function useActivateCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) => apiClient.post<CatalogueEntry>(EP.CATALOGUE_ACTIVATE(gameId), {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogueQueryKey }),
  });
}

export function useDeactivateCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) => apiClient.post<CatalogueEntry>(EP.CATALOGUE_DEACTIVATE(gameId), {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogueQueryKey }),
  });
}

export function useDeleteCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) => apiClient.delete<void>(EP.CATALOGUE_ENTRY(gameId)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogueQueryKey }),
  });
}
