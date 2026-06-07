import { useRef, useState } from 'react';

import { CategoryChip, DrawerService, GameTile } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Repeat } from 'meemaw';

import { GAME_ICON } from '../../../../shared/games/game-icons.ts';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_TAG,
  GAMES,
  GameCategory,
  type LandingGame,
} from '../../../../shared/games/games-manifest.ts';

gsap.registerPlugin(ScrollTrigger);

// E — the catalogue showcase. All 18 games, lucide signature icons (not internal numbers)
// as the anchor, filterable by category. Filtering dims non-matching tiles in place rather
// than removing them — no layout shift, smooth fade. Tiles reveal on scroll-in (staggered).
// The breadth here is the product wedge, so we show the full grid, not a teaser.

const ALL_FILTER = 'all' as const;
type ShowcaseFilter = GameCategory | typeof ALL_FILTER;

export function GamesShowcase() {
  const [filter, setFilter] = useState<ShowcaseFilter>(ALL_FILTER);
  const grid = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-game-tile]', {
          opacity: 0,
          y: 24,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.06,
          // Clear GSAP's inline transform/opacity once revealed so it never overrides the
          // dim-state style or leaves a residual transform that skews the tile's height.
          clearProps: 'transform,opacity',
          scrollTrigger: { trigger: grid.current, start: 'top 85%', once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: grid },
  );

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

      <div
        role="group"
        aria-label="Filter games by category"
        className="mb-7 flex flex-wrap justify-center gap-2"
      >
        <CategoryChip
          category={GameCategory.CASUAL}
          active={filter === ALL_FILTER}
          onClick={() => setFilter(ALL_FILTER)}
        >
          All games
        </CategoryChip>
        <Repeat each={CATEGORY_ORDER as GameCategory[]}>
          {(category) => (
            <CategoryChip
              key={category}
              category={category}
              active={filter === category}
              onClick={() => setFilter(category)}
            >
              {CATEGORY_LABEL[category]}
            </CategoryChip>
          )}
        </Repeat>
      </div>

      <div ref={grid} className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Repeat each={GAMES as LandingGame[]}>
          {(game) => {
            const Icon = GAME_ICON[game.key];
            const dimmed = filter !== ALL_FILTER && game.category !== filter;
            return (
              // Grid cell: pure layout, never transformed — so the row stays equal-height.
              <div key={game.key} className="h-full">
                {/* Inner wrapper owns the dim + GSAP reveal transforms, isolated from layout. */}
                <div
                  data-game-tile
                  aria-hidden={dimmed ? true : undefined}
                  className={`h-full transition-[opacity,transform] duration-200 ease-in-out ${
                    dimmed ? 'pointer-events-none' : ''
                  }`}
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
                    onClick={() =>
                      DrawerService.toast(`${game.title} is coming soon.`, { tone: 'info' })
                    }
                  />
                </div>
              </div>
            );
          }}
        </Repeat>
      </div>
    </section>
  );
}
