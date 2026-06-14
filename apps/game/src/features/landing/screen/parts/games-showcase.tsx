import { useNavigate } from 'react-router-dom';

import { CatalogueGrid, useCatalogue } from '../../../../shared/catalogue/index.ts';
import { ROUTES, pathWith } from '../../../../shared/constants/routes.ts';

// E — the catalogue showcase. Reads the central catalogue store (one query, shared cache) and
// renders through the shared CatalogueGrid: lucide signature icons as the anchor, category filters
// that appear only when there are >10 games, dimming-in-place filter, staggered scroll-reveal.
// The breadth here is the product wedge, so we show the full grid. Clicking a tile is the game-first
// entry: it routes to /play/:gameId to choose solo vs multiplayer. `placeholderData` means the
// static manifest renders instantly on cold load / if the API is unreachable.

export function GamesShowcase() {
  const navigate = useNavigate();
  const { data } = useCatalogue();
  const games = data ?? [];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-6 text-center">
        <h2 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink sm:text-[34px]">
          Eighteen ways to play
        </h2>
        <p className="mt-2 font-sans text-[15px] text-ink-3">
          Quick rounds, brain-benders, party chaos, and full-on mystery cases.
        </p>
      </div>

      <CatalogueGrid
        games={games}
        animate
        onPick={(game) => navigate(pathWith(ROUTES.PLAY_MODE, { gameId: String(game.id) }))}
      />
    </section>
  );
}
