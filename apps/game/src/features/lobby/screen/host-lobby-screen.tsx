import { useState } from 'react';

import { Banner, Button, Card, DrawerService, GameId, PlayerPill, QrCode } from '@gbedity/ui';
import { Check, Copy, EllipsisVertical, Play as PlayIcon, Settings, Trash2 } from '@icons';
import { Show } from 'meemaw';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useEndGame } from '../../../shared/api/use-end-game.ts';
import { useLobby } from '../../../shared/api/use-lobby.ts';
import { useStartGame } from '../../../shared/api/use-start-game.ts';
import { useStartLeague } from '../../../shared/api/use-start-league.ts';
import { findGame, useCatalogue, useGameSelection } from '../../../shared/catalogue/index.ts';
import { ROUTES, joinUrl, pathWith } from '../../../shared/constants/routes.ts';
import { gameQueue, useGameQueue, type QueuedGame } from '../../../shared/games/game-queue.ts';
import { useSyncLineup } from '../../../shared/games/use-sync-lineup.ts';
import { endSessionOnce } from '../../../shared/realtime/end-session.ts';
import { useRoomGoneGuard } from '../../../shared/realtime/use-room-gone-guard.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import { log, useLogMount } from '../../../shared/observability/logger.ts';
import { ApiError, ApiErrorCode } from '../../../shared/services/api-error.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';
import { seatForIndex } from '../seat.ts';

// The create-room default nickname; show the host as "You" instead of leaking the placeholder.
const HOST_DEFAULT_NICKNAME = 'Host';

// §2.3 — host lobby. Live roster from GET /rooms/:code. "Pick a game" → catalogue carrying
// the room code. The first roster entry is the host.
// Scoped logger — every event from this screen auto-tags component 'HostLobby'.
const logHost = log.scope('HostLobby');

export function HostLobbyScreen() {
  const { code = '' } = useParams();
  useLogMount('HostLobby', { code });
  const navigate = useNavigate();
  const { go, curtain } = useStageNav();
  const lobby = useLobby(code);
  // Surface a gone/closed room loudly (no silent poll failures): host gets a "re-open room" modal.
  useRoomGoneGuard(lobby, { code, role: 'host' });
  const queue = useGameQueue(code);
  // Mirror the local queue to the room (add / remove / reorder) so players + display see the
  // lineup. One-way publish; the local queue stays the editing source of truth.
  useSyncLineup(code);
  const startGame = useStartGame();
  const startLeague = useStartLeague();
  const endGame = useEndGame();
  const { data: catalogue } = useCatalogue();
  const { selectGame } = useGameSelection();
  const hostId = sessionStore.getHost()?.hostId ?? '';
  const players = lobby.data?.players ?? [];
  const [copied, setCopied] = useState(false);

  // "Pick a game" / "Add another" → the central selection overlay (excluding already-queued
  // games), then on to that game's configure screen carrying the room code.
  function pickGame() {
    const exclude = queue.map((q) => q.key as string);
    void selectGame({ title: 'Pick a game', exclude }).then((game) => {
      if (game) go(pathWith(ROUTES.HOST_CONFIGURE, { gameId: String(game.id) }), { code });
    });
  }

  function copyCode() {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  // Start a single queued game. The host lands on the LIVE HOST screen (it plays + has host
  // controls) — NOT the display (F-1/F-2). The display is opened separately on the shared
  // screen via the lobby's "Open the shared screen" link / display_url.
  function startOne(q: QueuedGame) {
    logHost.event(LogEvent.LOBBY_START_GAME_CLICK, {
      uid: q.uid,
      gameId: q.gameId,
      backendId: q.backendId ?? null,
      hostId,
      hasConfig: Object.keys(q.config).length > 0,
    });
    if (q.backendId !== undefined) {
      startGame.mutate(
        { code, hostId, gameId: q.backendId, config: q.config },
        {
          onSuccess: () => {
            logHost.event(LogEvent.NAV_TO, { to: 'host_game', live: q.backendId });
            go(pathWith(ROUTES.HOST_GAME, { code }), { live: q.backendId });
          },
          onError: (e) => {
            const code409 = e instanceof ApiError ? e.code : 'unknown';
            logHost.event(LogEvent.LOBBY_START_FAILED, { gameId: q.backendId, code: code409, status: e instanceof ApiError ? e.status : 0 });
            // A game is already running in this room. Don't dead-end on the error — let the host
            // join the running game or end it. We switch on the coded error, never the message.
            if (e instanceof ApiError && e.code === ApiErrorCode.GAME_ALREADY_RUNNING) {
              logHost.event(LogEvent.LOBBY_GAME_ALREADY_RUNNING, { clickedGameId: q.backendId });
              void promptRunningGame();
              return;
            }
            DrawerService.toast(e instanceof ApiError ? e.message : 'Could not start.', { tone: 'danger' });
          },
        },
      );
      return;
    }
    logHost.event(LogEvent.NAV_TO, { to: 'host_game', mock: q.gameId });
    go(pathWith(ROUTES.HOST_GAME, { code }), { mock: q.gameId });
  }

  // Offer to join the in-flight game or end it (then back to lobby). The server just told us a
  // game IS running (game_already_running), so fetch the lobby FRESH to learn which one — never
  // trust the cached snapshot, which may predate the start (that stale read is what made this
  // always fall through to a useless toast). Only the truly-ended race (fresh fetch says no
  // active game) shows "try again".
  async function promptRunningGame() {
    const fresh = await lobby.refetch();
    const running = fresh.data?.activeGame ?? null;
    // THE CRUX: what did the fresh lobby read actually return? If activeGame is null here while
    // the server returned game_already_running, the refetch is the suspect (stale/disabled query).
    logHost.event(LogEvent.LOBBY_RUNNING_REFETCH_RESULT, {
      fetchStatus: fresh.status,
      isError: fresh.isError,
      phase: fresh.data?.phase ?? null,
      activeGame: running,
      code,
    });
    if (running === null) {
      // Genuine race: the game ended between our Start and this refetch. The lobby is now live
      // again, so the host can just press Start.
      logHost.event(LogEvent.LOBBY_RUNNING_RACE_TOAST, { reason: 'refetch_activeGame_null' });
      DrawerService.toast('That game just ended — press Start again.', { tone: 'info' });
      return;
    }
    const runningGameId = running.gameId;
    const runningTitle = findGame(catalogue ?? [], runningGameId)?.title ?? 'A game';
    logHost.event(LogEvent.LOBBY_RUNNING_PROMPT_SHOWN, { runningGameId, runningTitle });

    function joinRunning() {
      logHost.event(LogEvent.LOBBY_JOIN_RUNNING_CLICK, { runningGameId });
      DrawerService.closeModal();
      go(pathWith(ROUTES.HOST_GAME, { code }), { live: runningGameId });
    }
    function endRunning() {
      logHost.event(LogEvent.LOBBY_END_RUNNING_CLICK, { runningGameId, hostId });
      DrawerService.closeModal();
      endGame.mutate(
        { code, hostId },
        {
          onSuccess: () => {
            logHost.event(LogEvent.ROOM_GAME_OVER, { via: 'host_end_running' });
            DrawerService.toast('Game ended. You’re back in the lobby.', { tone: 'default' });
          },
          onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not end the game.', { tone: 'danger' }),
        },
      );
    }

    // A two-action choice — both deliberate (Join = primary, End = destructive). A custom modal,
    // not confirm(): confirm's cancel slot would style "End" as muted AND fire it on accidental
    // scrim/Escape dismiss, which must never silently end a live game.
    DrawerService.openModal(
      <div>
        <h2 className="m-0 mb-[6px] font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
          {runningTitle} is already running
        </h2>
        <p className="m-0 mb-[22px] text-[15px] leading-[1.55] text-ink-2">
          Join the game in progress, or end it and return to the lobby.
        </p>
        <div className="flex justify-end gap-[10px]">
          <Button variant="danger" onClick={endRunning}>
            End it
          </Button>
          <Button variant="primary" onClick={joinRunning}>
            Join it
          </Button>
        </div>
      </div>,
    );
  }

  // Start the whole queue as a league (≥2 games), backed games only.
  function startLeagueRun() {
    const backed = queue.filter((q) => q.backendId !== undefined);
    if (backed.length < 2) {
      DrawerService.toast('Add at least two backed games for a league.', { tone: 'info' });
      return;
    }
    startLeague.mutate(
      { code, hostId, queue: backed.map((q) => ({ gameId: q.backendId as string, config: q.config, weight: q.weight })) },
      {
        onSuccess: () => go(pathWith(ROUTES.DISPLAY_LOBBY, { code })),
        onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not start the league.', { tone: 'danger' }),
      },
    );
  }

  function playerMenu(name: string) {
    DrawerService.confirm(`Manage ${name}`, {
      description: 'Hand off host, or remove them from the room.',
      confirmLabel: 'Boot player',
      cancelLabel: 'Close',
      destructive: true,
      onConfirm: () => DrawerService.toast(`${name} was removed.`, { tone: 'default' }),
    });
  }

  function endSession() {
    DrawerService.confirm('End this session?', {
      description: 'This closes the room and sends everyone back home. You can always start a new one.',
      confirmLabel: 'End & close room',
      cancelLabel: 'Keep room open',
      destructive: true,
      onConfirm: () => {
        // Tell the server to close the room — it boots every other client to the closed screen.
        // The host lobby is socketless (it polls), so we fire a one-shot host socket to emit it,
        // then navigate home ourselves (fire-and-forget — don't block on the socket).
        void endSessionOnce(code);
        sessionStore.clearRoom();
        navigate(ROUTES.LANDING);
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader
        right={
          <button type="button" aria-label="Room settings" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink hover:bg-canvas-deep">
            <Settings size={18} aria-hidden="true" />
          </button>
        }
      />
      {/* A game is already running but the host is back on the lobby (refresh / navigated away) —
          offer a one-tap rejoin into the live host screen. */}
      <Show when={lobby.data?.phase === 'in_game'}>
        <div className="mx-auto w-full max-w-md px-6 pt-4 lg:max-w-4xl">
          <Banner
            tone="info"
            title="A game is in progress"
            description="You left the live game — jump back in to keep hosting."
            cta={{ label: 'Rejoin game', onClick: () => go(pathWith(ROUTES.HOST_GAME, { code })) }}
          />
        </div>
      </Show>
      {/* Mobile: single stacked column. Desktop (lg): a true 2×2 grid — no scroll:
          Marquee │ Players  /  Games │ QR. */}
      <main className="mx-auto grid w-full max-w-md flex-1 grid-cols-1 content-start gap-4 px-6 pt-4 lg:max-w-4xl lg:grid-cols-2 lg:items-start">
        {/* Top-left: the marquee. The room code is the hero — the host's one job is to share it. */}
        <Card size="lg" className="flex flex-col items-center gap-1 text-center">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-3">
            Room code
          </p>
          <span className="font-serif text-[48px] font-semibold leading-none tracking-[0.12em] text-ink">
            {code}
          </span>
          <span className="mt-1 font-sans text-[14px] text-ink-3">
            {players.length} {players.length === 1 ? 'player' : 'players'} joined · share this code
          </span>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={
                copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />
              }
              onClick={copyCode}
            >
              {copied ? 'Copied' : 'Copy code'}
            </Button>
            <Link
              to={pathWith(ROUTES.DISPLAY_LOBBY, { code })}
              className="font-sans text-[13px] font-bold text-action hover:text-action-deep"
            >
              Open on a shared screen →
            </Link>
          </div>
        </Card>

        <Card size="lg" className="flex flex-col gap-2">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Players</h2>
          {players.map((p, i) => {
            const isHost = p.id === hostId;
            // Show the host's real nickname, but never leak the "Host" create-room default —
            // fall back to "You" (the "(you · host)" tag already identifies them).
            const displayName = isHost && p.nickname === HOST_DEFAULT_NICKNAME ? 'You' : p.nickname;
            return (
              <PlayerPill
                key={p.id}
                name={displayName}
                avatarId={p.id}
                seat={seatForIndex(i)}
                size="sm"
                tag={isHost ? '(you · host)' : undefined}
                trailing={
                  isHost ? undefined : (
                    <button type="button" aria-label={`Manage ${p.nickname}`} onClick={() => playerMenu(p.nickname)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                      <EllipsisVertical size={18} aria-hidden="true" />
                    </button>
                  )
                }
              />
            );
          })}
          {players.length === 0 ? (
            <p className="py-3 text-center font-sans text-[13px] text-ink-3">No players yet.</p>
          ) : null}

          {/* Waiting indicator lives with the Players list — it's the players we're waiting on. */}
          <div className="mt-1 flex items-center justify-center gap-2 pt-1" aria-label="Waiting for players">
            <span className="font-sans text-[12px] font-semibold text-ink-3">Waiting for players</span>
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-[6px] w-[6px] rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </div>
        </Card>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Games</h2>

          {queue.length === 0 ? (
            <p className="font-sans text-[14px] text-ink-3">No game picked yet. Choose one to get started.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map((q) => {
                const g = findGame(catalogue ?? [], q.gameId);
                return (
                  <div key={q.uid} className="flex items-center gap-3 rounded-card bg-canvas px-3 py-3">
                    {g !== undefined ? <GameId id={g.id} category={g.category} size="sm" /> : null}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-[15px] font-bold text-ink">{q.title}</span>
                      {q.backendId === undefined ? (
                        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-4">Preview only</span>
                      ) : null}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      leadingIcon={<PlayIcon size={14} aria-hidden="true" />}
                      loading={startGame.isPending}
                      onClick={() => startOne(q)}
                    >
                      Start
                    </Button>
                    <button type="button" aria-label={`Remove ${q.title}`} onClick={() => gameQueue.remove(code, q.uid)} className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-danger">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <Button variant={queue.length === 0 ? 'primary' : 'secondary'} size="lg" className="w-full" onClick={pickGame}>
            {queue.length === 0 ? 'Pick a game' : 'Add another game'}
          </Button>

          {queue.length >= 2 ? (
            <Button variant="celebrate" size="lg" className="w-full" loading={startLeague.isPending} onClick={startLeagueRun}>
              Start league ({queue.length} games)
            </Button>
          ) : null}
        </Card>

        {/* QR card (bottom-right). The QR fills the card; players scan it to join. */}
        <Card size="lg" className="flex flex-col items-center gap-3 text-center">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Scan to join
          </p>
          <QrCode url={joinUrl(code)} fluid className="max-w-[320px]" />
          <p className="max-w-[36ch] font-sans text-[13px] leading-[1.5] text-ink-3">
            Players join at <span className="font-bold text-ink-2">gbedity.app</span> with this code — or scan.
          </p>
        </Card>
      </main>

      {/* End session — committed sticky bar with real elevation (border + lift shadow). */}
      <div className="sticky inset-x-0 bottom-0 border-t border-ink-5 bg-surface px-6 py-4 shadow-[0_-8px_24px_rgba(31,107,74,0.06)]">
        <div className="mx-auto max-w-md">
          <Button variant="ghost" className="w-full" onClick={endSession}>End session</Button>
        </div>
      </div>
      {curtain}
    </div>
  );
}
