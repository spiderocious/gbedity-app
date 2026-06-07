import { useRef, useState } from 'react';

import { CategoryChip, GameTile } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Repeat, Show } from 'meemaw';

import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_TAG, GameCategory } from '../games/games-manifest.ts';
import { iconFor } from './catalogue-icon.ts';
import type { CatalogueGame } from './catalogue.types.ts';

// The one games grid. Showcase, host catalogue, and the selection overlay all render through this,
// so the filter behaviour + dimming + tiles live in one place (kills the showcase/catalogue-screen
// duplication). Callers supply onPick (toast on the marketing page, resolve(game) in the picker,
// route in the host catalogue).
//
// Dynamic filters (locked rule): the category chips render ONLY when the UNFILTERED total > 10 —
// gated on `games.length` (the original set), NOT the currently-filtered count. So narrowing to 3
// never hides the chips, and a small catalogue (≤10) shows no filter UI at all.

const ALL = 'all' as const;
type Filter = GameCategory | typeof ALL;

const FILTER_THRESHOLD = 10;

export interface CatalogueGridProps {
  readonly games: readonly CatalogueGame[];
  readonly onPick: (game: CatalogueGame) => void;
  /** Stagger-reveal tiles on scroll-in (marketing showcase). Off in the picker/host catalogue. */
  readonly animate?: boolean;
}

export function CatalogueGrid({ games, onPick, animate = false }: CatalogueGridProps) {
  const [filter, setFilter] = useState<Filter>(ALL);
  const grid = useRef<HTMLDivElement>(null);

  // Gate on the ORIGINAL count, computed before any category filter applies.
  const showFilters = games.length > FILTER_THRESHOLD;

  useGSAP(
    () => {
      if (!animate) return;
      // Register the scroll plugin lazily — only when this grid actually animates — so merely
      // importing the grid (e.g. in non-animated screens / jsdom tests) never touches matchMedia.
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-game-tile]', {
          opacity: 0,
          y: 24,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.06,
          clearProps: 'transform,opacity',
          scrollTrigger: { trigger: grid.current, start: 'top 85%', once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: grid, dependencies: [animate] },
  );

  return (
    <div>
      <Show when={showFilters}>
        <div role="group" aria-label="Filter games by category" className="mb-7 flex flex-wrap justify-center gap-2">
          <CategoryChip category={GameCategory.CASUAL} active={filter === ALL} onClick={() => setFilter(ALL)}>
            All games
          </CategoryChip>
          <Repeat each={CATEGORY_ORDER as GameCategory[]}>
            {(category) => (
              <CategoryChip key={category} category={category} active={filter === category} onClick={() => setFilter(category)}>
                {CATEGORY_LABEL[category]}
              </CategoryChip>
            )}
          </Repeat>
        </div>
      </Show>

      <div ref={grid} className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Repeat each={games as CatalogueGame[]}>
          {(game) => {
            const Icon = iconFor(game.iconName);
            // Dim non-matching tiles in place (no layout shift / remount), matching today's UX.
            const dimmed = filter !== ALL && game.category !== filter;
            return (
              <div key={game.key} className="h-full">
                <div
                  data-game-tile
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
                    onClick={() => onPick(game)}
                  />
                </div>
              </div>
            );
          }}
        </Repeat>
      </div>
    </div>
  );
}
