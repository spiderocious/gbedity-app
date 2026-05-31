import { useState } from 'react';

import { Button, Card, DrawerService, GameId, Segmented } from '@gbedity/ui';
import { GripVertical, Plus, Trophy, Trash2 } from '@icons';

import { ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { GameKey, gameByKey, type LandingGame } from '../../../shared/games/games-manifest.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §3.2 — league queue builder. Pre-loaded with 3 sample games; weight selectors; reorder
// handles (visual); remove with confirm. Start enabled at ≥2 games.
interface QueuedGame {
  readonly game: LandingGame;
  readonly weight: string;
}

const INITIAL: readonly GameKey[] = [GameKey.WORD_BOMB, GameKey.CATCH_THE_LIE, GameKey.PLEAD_YOUR_CASE];

export function LeagueBuilderScreen() {
  const { go, curtain } = useStageNav();
  const [queue, setQueue] = useState<QueuedGame[]>(() =>
    INITIAL.map((k, i) => {
      const game = gameByKey(k);
      return game ? { game, weight: i === 1 ? '2×' : '1×' } : undefined;
    }).filter((x): x is QueuedGame => x !== undefined),
  );

  function remove(id: number, title: string) {
    DrawerService.confirm(`Remove ${title}?`, {
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      destructive: true,
      onConfirm: () => setQueue((q) => q.filter((x) => x.game.id !== id)),
    });
  }

  function setWeight(id: number, weight: string) {
    setQueue((q) => q.map((x) => (x.game.id === id ? { ...x, weight } : x)));
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <AppHeader backTo={ROUTES.HOST_NEW} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pt-2">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Build the league</h1>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">League settings</h2>
          <input defaultValue="Friday Night League" className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[16px] font-semibold text-ink focus:border-action focus:outline-none" />
          <div className="flex items-center justify-between">
            <span className="font-sans text-[14px] font-bold text-ink">Aggregate scoring</span>
            <Segmented size="sm" value="Sum" onChange={() => undefined} ariaLabel="Aggregate scoring" options={['Sum', 'Average', 'Top-3'].map((o) => ({ value: o, label: o }))} />
          </div>
        </Card>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Queued games</h2>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Trophy size={40} aria-hidden="true" className="text-ink-4" />
              <p className="font-serif text-[18px] font-semibold text-ink">No games yet</p>
              <Button variant="primary" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => go(`${ROUTES.HOST_CATALOGUE}?mode=league`)}>
                Add a game
              </Button>
            </div>
          ) : (
            queue.map((q) => (
              <div key={q.game.id} className="flex items-center gap-3 rounded-card bg-canvas px-3 py-3">
                <GripVertical size={18} aria-hidden="true" className="flex-shrink-0 text-ink-4" />
                <GameId id={q.game.id} category={q.game.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[15px] font-bold text-ink">{q.game.title}</span>
                  <span className="font-sans text-[12px] text-ink-3">{q.game.meta}</span>
                </div>
                <Segmented size="sm" value={q.weight} onChange={(w) => setWeight(q.game.id, w)} ariaLabel="Weight" options={['1×', '2×', '3×'].map((o) => ({ value: o, label: o }))} />
                <button type="button" aria-label={`Remove ${q.game.title}`} onClick={() => remove(q.game.id, q.game.title)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-danger">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
          {queue.length > 0 ? (
            <Button variant="secondary" leadingIcon={<Plus size={16} aria-hidden="true" />} onClick={() => go(`${ROUTES.HOST_CATALOGUE}?mode=league`)}>
              Add a game
            </Button>
          ) : null}
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink-5 bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="primary" size="lg" className="flex-1" disabled={queue.length < 2} onClick={() => go(mockPath(ROUTES.DISPLAY_LOBBY))}>
            Start league
          </Button>
          <Button variant="ghost" onClick={() => go(ROUTES.HOST_NEW)}>Cancel</Button>
        </div>
      </div>
      {curtain}
    </div>
  );
}
