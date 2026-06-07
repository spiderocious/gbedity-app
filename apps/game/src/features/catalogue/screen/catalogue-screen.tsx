import { useSearchParams } from 'react-router-dom';

import { CatalogueGrid, useCatalogue } from '../../../shared/catalogue/index.ts';
import { ROUTES, mockPath, pathWith } from '../../../shared/constants/routes.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §3.1 — host game catalogue. Reads the central catalogue store and renders the shared grid; a
// tile routes to its configure screen, carrying the live room code. Loading/error/empty states
// (the static array never needed these); placeholderData shows games instantly on cold load.
export function CatalogueScreen() {
  const { go, curtain } = useStageNav();
  const [search] = useSearchParams();
  const code = search.get('code') ?? '';
  const backTo = code !== '' ? pathWith(ROUTES.HOST_LOBBY, { code }) : mockPath(ROUTES.HOST_LOBBY);

  const { data, isLoading, isError, refetch } = useCatalogue();
  const games = data ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader backTo={backTo} />
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-2">
        <h1 className="mb-6 font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Pick a game</h1>

        {isLoading ? (
          <p role="status" className="py-16 text-center font-sans text-[15px] text-ink-3">
            Loading games…
          </p>
        ) : isError ? (
          <div role="alert" className="py-16 text-center">
            <p className="font-sans text-[15px] text-ink-3">Couldn’t load games.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 font-sans text-[14px] font-bold text-action hover:text-action-deep"
            >
              Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <p className="py-16 text-center font-sans text-[15px] text-ink-3">No games live yet.</p>
        ) : (
          <CatalogueGrid
            games={games}
            onPick={(game) => go(pathWith(ROUTES.HOST_CONFIGURE, { gameId: String(game.id) }), { code: code || undefined })}
          />
        )}
      </main>
      {curtain}
    </div>
  );
}
