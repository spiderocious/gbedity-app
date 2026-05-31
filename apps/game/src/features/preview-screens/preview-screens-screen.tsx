import { Card, Pill } from '@gbedity/ui';
import { ArrowUpRight } from '@icons';
import { Link } from 'react-router-dom';

import { ROUTES, mockPath } from '../../shared/constants/routes.ts';
import { GAME_ICON } from '../../shared/games/game-icons.ts';
import { gameById } from '../../shared/games/games-manifest.ts';
import { AppHeader } from '../../shared/widgets/app-header.tsx';
import {
  PER_GAME_SCREENS,
  SCREEN_INDEX,
  ScreenContext,
  type ScreenLink,
} from './screen-index.ts';

// Dev-facing jump page (/preview-screens): every screen with a clickable link so you can
// open any one directly, without walking the whole flow. Not user-facing.

const CONTEXT_TONE: Record<ScreenContext, 'info' | 'special' | 'action' | 'default'> = {
  [ScreenContext.DISPLAY]: 'info',
  [ScreenContext.HOST]: 'special',
  [ScreenContext.PLAYER]: 'action',
  [ScreenContext.ANY]: 'default',
};

function ScreenRow({ screen }: { readonly screen: ScreenLink }) {
  return (
    <Link
      to={screen.path}
      className="group flex items-center gap-3 rounded-card bg-canvas px-4 py-3 transition-colors duration-150 hover:bg-canvas-deep"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-sans text-[15px] font-bold text-ink">{screen.label}</span>
          <Pill tone={CONTEXT_TONE[screen.context]}>{screen.context}</Pill>
        </span>
        <span className="mt-[2px] block truncate font-mono text-[12px] text-ink-3">{screen.path}</span>
        {screen.note !== undefined ? (
          <span className="font-sans text-[11px] italic text-ink-4">{screen.note}</span>
        ) : null}
      </span>
      <ArrowUpRight size={18} aria-hidden="true" className="flex-shrink-0 text-ink-4 group-hover:text-ink-2" />
    </Link>
  );
}

export function PreviewScreensScreen() {
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <AppHeader backTo={ROUTES.LANDING} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-2">
        <div>
          <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">All screens</h1>
          <p className="mt-1 font-sans text-[14px] text-ink-3">
            Jump straight to any screen. Each link is pre-filled with mock params (room GBE-4ZK).
          </p>
        </div>

        {SCREEN_INDEX.map((group) => (
          <section key={group.section} className="flex flex-col gap-2">
            <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
              {group.section}
            </h2>
            {group.screens.map((s) => (
              <ScreenRow key={s.path} screen={s} />
            ))}
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            §9–26 · Per-game (display · player · result)
          </h2>
          {PER_GAME_SCREENS.map((g) => {
            const game = gameById(g.id);
            const Icon = game ? GAME_ICON[game.key] : undefined;
            return (
              <Card key={g.id} size="sm" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex min-w-[150px] items-center gap-2">
                  {Icon !== undefined ? <Icon size={18} aria-hidden="true" className="text-ink-3" /> : null}
                  <span className="font-sans text-[14px] font-bold text-ink">{g.title}</span>
                </span>
                <Link to={`${mockPath(ROUTES.DISPLAY_GAME)}?mock=${g.id}`} className="font-sans text-[13px] font-bold text-action hover:text-action-deep">Display</Link>
                <Link to={`${mockPath(ROUTES.PLAYER_GAME)}?mock=${g.id}`} className="font-sans text-[13px] font-bold text-action hover:text-action-deep">Player</Link>
                <Link to={`${mockPath(ROUTES.HOST_GAME)}?mock=${g.id}`} className="font-sans text-[13px] font-bold text-action hover:text-action-deep">Host</Link>
                <Link to={`${mockPath(ROUTES.DISPLAY_RESULT)}?mock=${g.id}`} className="font-sans text-[13px] font-bold text-action hover:text-action-deep">Result</Link>
                <Link to={mockPath(ROUTES.HOST_CONFIGURE, String(g.id))} className="font-sans text-[13px] font-bold text-action hover:text-action-deep">Configure</Link>
              </Card>
            );
          })}
        </section>
      </main>
    </div>
  );
}
