import { useState } from 'react';

import { CategoryChip, GameTile } from '@gbedity/ui';
import { Repeat } from 'meemaw';
import { useSearchParams } from 'react-router-dom';

import { ROUTES, mockPath, pathWith } from '../../../shared/constants/routes.ts';
import { GAME_ICON } from '../../../shared/games/game-icons.ts';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_TAG,
  GAMES,
  GameCategory,
  type LandingGame,
} from '../../../shared/games/games-manifest.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §3.1 — host game catalogue. 18 tiles, filterable; a tile routes to its configure screen.
const ALL = 'all' as const;
type Filter = GameCategory | typeof ALL;

export function CatalogueScreen() {
  const [filter, setFilter] = useState<Filter>(ALL);
  const { go, curtain } = useStageNav();
  const [search] = useSearchParams();
  const code = search.get('code') ?? '';
  const backTo = code !== '' ? pathWith(ROUTES.HOST_LOBBY, { code }) : mockPath(ROUTES.HOST_LOBBY);

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader backTo={backTo} />
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-2">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Pick a game</h1>

        <div role="group" aria-label="Filter games" className="my-6 flex flex-wrap gap-2">
          <CategoryChip category={GameCategory.CASUAL} active={filter === ALL} onClick={() => setFilter(ALL)}>
            All games
          </CategoryChip>
          <Repeat each={CATEGORY_ORDER as GameCategory[]}>
            {(c) => (
              <CategoryChip key={c} category={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]}
              </CategoryChip>
            )}
          </Repeat>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Repeat each={GAMES as LandingGame[]}>
            {(game) => {
              const Icon = GAME_ICON[game.key];
              const dimmed = filter !== ALL && game.category !== filter;
              return (
                <div
                  key={game.key}
                  aria-hidden={dimmed ? true : undefined}
                  className={`h-full transition-[opacity,transform] duration-200 ease-in-out ${dimmed ? 'pointer-events-none' : ''}`}
                  style={{ opacity: dimmed ? 0.2 : 1, transform: dimmed ? 'scale(0.95)' : 'none' }}
                >
                  <GameTile
                    id={game.id}
                    category={game.category}
                    tag={CATEGORY_TAG[game.category]}
                    title={game.title}
                    meta={game.meta}
                    description={game.description}
                    icon={<Icon size={20} aria-hidden="true" />}
                    onClick={() => go(pathWith(ROUTES.HOST_CONFIGURE, { gameId: String(game.id) }), { code: code || undefined })}
                  />
                </div>
              );
            }}
          </Repeat>
        </div>
      </main>
      {curtain}
    </div>
  );
}
