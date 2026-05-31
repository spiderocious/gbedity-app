import { Button, Card, DrawerService, GameId, PreviewRail, Pill } from '@gbedity/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { backendGameId, buildStartConfig } from '../../../shared/games/config-map.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameQueue } from '../../../shared/games/game-queue.ts';
import { CATEGORY_TAG, gameById } from '../../../shared/games/games-manifest.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { ConfigControlRow } from '../parts/config-control.tsx';

// §4.1 — universal configure shell. Reads :gameId → game + content registry, renders the
// per-game config groups generically + the preview rail. Configure is pure prep: "Add to
// room" saves this game + its config to the room's queue and returns to the room. Starting
// happens in the room, per game.
export function ConfigureScreen() {
  const { gameId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const game = gameById(gameId ?? '');
  const content = game ? getGameContent(game.key) : undefined;
  const code = search.get('code') ?? sessionStore.getHost()?.roomCode ?? '';
  const backendId = game ? backendGameId(game.key) : undefined;
  // Back to the catalogue, preserving the live room code so the chain doesn't fall back to mock.
  const catalogueBack = code !== '' ? `${ROUTES.HOST_CATALOGUE}?code=${code}` : ROUTES.HOST_CATALOGUE;

  function handleAddToRoom() {
    if (game === undefined || code === '') return;
    gameQueue.add(code, {
      gameId: game.id,
      key: game.key,
      title: game.title,
      ...(backendId !== undefined ? { backendId } : {}),
      config: buildStartConfig(),
      weight: 1,
    });
    DrawerService.toast(`${game.title} added to the room.`, { tone: 'success' });
    navigate(pathWith(ROUTES.HOST_LOBBY, { code }));
  }

  if (game === undefined || content === undefined) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader backTo={catalogueBack} />
        <p className="mx-auto max-w-md px-6 pt-10 text-center font-sans text-[15px] text-ink-3">
          That game isn’t available.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <AppHeader
        backTo={catalogueBack}
        right={
          <Button variant="ghost" size="sm" onClick={() => undefined}>Use defaults</Button>
        }
      />
      <main className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 pt-2 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <Card size="lg" className="flex items-center gap-4">
            <GameId id={game.id} category={game.category} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">{game.title}</h1>
                <Pill tone="default">{CATEGORY_TAG[game.category]}</Pill>
              </div>
              <p className="mt-1 font-sans text-[13px] text-ink-3">{game.meta} · {game.description}</p>
            </div>
          </Card>

          {content.configGroups.map((group) => (
            <Card key={group.label} size="lg" className="flex flex-col">
              <h2 className="mb-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                {group.label}
              </h2>
              {group.controls.map((control) => (
                <ConfigControlRow key={control.id} control={control} />
              ))}
            </Card>
          ))}
        </div>

        <div className="lg:sticky lg:top-5 lg:self-start">
          <PreviewRail label="Live preview">
            {content.previewLines.map((line) => {
              const [k, v] = line.includes(':') ? [line.split(':')[0] ?? '', line.split(':').slice(1).join(':').trim()] : [line, ''];
              return (
                <div key={line} className="rounded-[14px] bg-canvas px-4 py-3">
                  <div className="font-sans text-[12px] font-bold text-ink-3">{k}</div>
                  {v !== '' ? <div className="mt-[2px] font-serif text-[18px] font-semibold text-ink">{v}</div> : null}
                </div>
              );
            })}
          </PreviewRail>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink-5 bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Button variant="primary" size="lg" className="flex-1" onClick={handleAddToRoom}>
            Add to room
          </Button>
          <Button variant="secondary" size="lg" onClick={handleAddToRoom}>Use defaults</Button>
        </div>
      </div>
    </div>
  );
}
