import { useEffect } from 'react';

import { Button, Card, DrawerService, GameId, PreviewRail, Pill } from '@gbedity/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { useStartSolo } from '../../../shared/api/use-start-solo.ts';
import { clientDrivenSoloRoute } from '../../games/solo-entry.ts';
import { buildStartConfig } from '../../../shared/games/config-map.ts';
import { configValues } from '../../../shared/games/config-values.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameQueue } from '../../../shared/games/game-queue.ts';
import { CATEGORY_TAG, type GameKey } from '../../../shared/games/games-manifest.ts';
import { ApiError } from '../../../shared/services/api-error.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { ConfigControlRow } from '../parts/config-control.tsx';

// §4.1 — universal configure shell. Reads :gameId from the central catalogue store → game + the
// client content registry, renders the per-game config groups + preview rail.
//
// Two callers share this shell, branched on the `?solo=1` flag set by the play-mode entry:
//  • multiplayer (default): configure is pure prep — "Add to room" queues this game + config on the
//    room and returns to the lobby; the game starts from there via its backend `gameId`.
//  • solo: configure IS the launch point — "Start" calls POST /solo/start with the built config and
//    drops straight into the player game surface (/p/:code/game). No room/lobby in between.
export function ConfigureScreen() {
  const { gameId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const startSolo = useStartSolo();
  const { game, isLoading } = useCatalogueGame(gameId);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const solo = search.get('solo') === '1';
  const code = search.get('code') ?? sessionStore.getHost()?.roomCode ?? '';
  // Solo came from the game-first entry (/play/:gameId); multiplayer came from the host catalogue.
  const back = solo
    ? (game ? pathWith(ROUTES.PLAY_MODE, { gameId: String(game.id) }) : ROUTES.LANDING)
    : code !== ''
      ? `${ROUTES.HOST_CATALOGUE}?code=${code}`
      : ROUTES.HOST_CATALOGUE;

  // Reset the shared config-values store whenever a different game is configured, so one game's
  // control values never leak into another's start config. Controls re-seed their defaults on mount.
  useEffect(() => {
    configValues.reset();
  }, [game?.key]);

  function handleAddToRoom() {
    if (game === undefined || code === '') return;
    gameQueue.add(code, {
      gameId: game.id,
      key: game.key as GameKey,
      title: game.title,
      backendId: game.gameId, // every catalogue game is startable via its own backend gameId
      config: buildStartConfig(game.key as GameKey),
      weight: 1,
    });
    DrawerService.toast(`${game.title} added to the room.`, { tone: 'success' });
    navigate(pathWith(ROUTES.HOST_LOBBY, { code }));
  }

  // Solo launch — build the same config the room flow would send, hand it to /solo/start, and go
  // straight to the player game surface keyed on the returned solo room code. A game with its own
  // client-driven solo slice (e.g. Missing Letters) instead navigates to its dedicated route, which
  // self-starts via REST.
  function handleStartSolo() {
    if (game === undefined || startSolo.isPending) return;
    const clientRoute = clientDrivenSoloRoute(game.gameId);
    if (clientRoute !== null) {
      navigate(clientRoute);
      return;
    }
    startSolo.mutate(
      { gameId: game.gameId, config: buildStartConfig(game.key as GameKey) },
      {
        onSuccess: (res) => navigate(pathWith(ROUTES.PLAYER_GAME, { code: res.soloId })),
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Couldn’t start this game.';
          DrawerService.toast(msg, { tone: 'danger' });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader backTo={back} />
        <p role="status" className="mx-auto max-w-md px-6 pt-10 text-center font-sans text-[15px] text-ink-3">
          Loading…
        </p>
      </div>
    );
  }

  if (game === undefined || content === undefined) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader backTo={back} />
        <p className="mx-auto max-w-md px-6 pt-10 text-center font-sans text-[15px] text-ink-3">
          That game isn’t available.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <AppHeader
        backTo={back}
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
          {solo ? (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              loading={startSolo.isPending}
              onClick={handleStartSolo}
            >
              Start game
            </Button>
          ) : (
            <>
              <Button variant="primary" size="lg" className="flex-1" onClick={handleAddToRoom}>
                Add to room
              </Button>
              <Button variant="secondary" size="lg" onClick={handleAddToRoom}>Use defaults</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
