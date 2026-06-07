import { useQuery, type QueryClient } from '@tanstack/react-query';

import { apiClient } from '../services/api-client.ts';
import { CatalogueResponse, type CatalogueCategory, type CatalogueGame } from './catalogue.types.ts';
import { GAMES_FALLBACK } from './catalogue-fallback.ts';

// THE central games store. Every place that shows games reads from this one query — because they
// share the queryKey, N consumers mounting at once trigger ONE network call and share the cache
// (the "one central store" property, for free). Selectors below derive from the same cache.

export const catalogueQueryKey = ['catalogue'] as const;

export function useCatalogue() {
  return useQuery({
    queryKey: catalogueQueryKey,
    queryFn: async (): Promise<CatalogueGame[]> => CatalogueResponse.parse(await apiClient.get('/catalogue')),
    // Static manifest shown instantly while the first fetch runs / if it fails. Fallback only —
    // the live query always wins once it resolves.
    placeholderData: GAMES_FALLBACK as CatalogueGame[],
    // 2-min freshness + 2-min background refresh: an admin activating a game in THIS environment's
    // DB surfaces within ~2 min (or instantly on tab-focus) without a hard reload, while avoiding
    // refetch churn while the host browses.
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true, // overrides the app-wide default (off)
    refetchOnReconnect: true,
    retry: 2, // overrides the app-wide default (off) — transient network only
  });
}

// Invalidate the store (e.g. after a future in-app admin mutation). One named helper so cache
// busting is explicit and discoverable.
export const invalidateCatalogue = (queryClient: QueryClient): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: catalogueQueryKey });

// ── Selectors — derive from the SAME cached query (no extra request) ──────────

const findGame = (games: readonly CatalogueGame[], idOrKey: string | number): CatalogueGame | undefined => {
  const asNum = typeof idOrKey === 'number' ? idOrKey : Number.parseInt(idOrKey, 10);
  return games.find((g) => g.id === asNum || g.key === idOrKey || g.gameId === idOrKey);
};

export { findGame };

// A single game by PRD id, kebab key, or backend gameId. Reads off the shared cache.
export function useCatalogueGame(idOrKey: string | number | undefined): {
  game: CatalogueGame | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useCatalogue();
  const game = idOrKey !== undefined && query.data ? findGame(query.data, idOrKey) : undefined;
  return { game, isLoading: query.isLoading, isError: query.isError };
}

// Games filtered to one category (or all). Reads off the shared cache.
export function useCatalogueByCategory(category: CatalogueCategory | 'all'): CatalogueGame[] {
  const { data } = useCatalogue();
  const games = data ?? [];
  return category === 'all' ? [...games] : games.filter((g) => g.category === category);
}
