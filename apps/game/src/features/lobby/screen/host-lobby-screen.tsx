import { useState } from 'react';

import { Button, Card, DrawerService, GameId, PlayerPill, QrCode } from '@gbedity/ui';
import { Check, Copy, EllipsisVertical, Play as PlayIcon, Settings, Trash2 } from '@icons';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useLobby } from '../../../shared/api/use-lobby.ts';
import { useStartGame } from '../../../shared/api/use-start-game.ts';
import { useStartLeague } from '../../../shared/api/use-start-league.ts';
import { ROUTES, joinUrl, pathWith } from '../../../shared/constants/routes.ts';
import { gameById } from '../../../shared/games/games-manifest.ts';
import { gameQueue, useGameQueue, type QueuedGame } from '../../../shared/games/game-queue.ts';
import { ApiError } from '../../../shared/services/api-error.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';
import { seatForIndex } from '../seat.ts';

// The create-room default nickname; show the host as "You" instead of leaking the placeholder.
const HOST_DEFAULT_NICKNAME = 'Host';

// §2.3 — host lobby. Live roster from GET /rooms/:code. "Pick a game" → catalogue carrying
// the room code. The first roster entry is the host.
export function HostLobbyScreen() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { go, curtain } = useStageNav();
  const lobby = useLobby(code);
  const queue = useGameQueue(code);
  const startGame = useStartGame();
  const startLeague = useStartLeague();
  const hostId = sessionStore.getHost()?.hostId ?? '';
  const players = lobby.data?.players ?? [];
  const [copied, setCopied] = useState(false);

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
    if (q.backendId !== undefined) {
      startGame.mutate(
        { code, hostId, gameId: q.backendId, config: q.config },
        {
          onSuccess: () => go(pathWith(ROUTES.HOST_GAME, { code }), { live: q.backendId }),
          onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not start.', { tone: 'danger' }),
        },
      );
      return;
    }
    go(pathWith(ROUTES.HOST_GAME, { code }), { mock: q.gameId });
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
    DrawerService.critical('End the session?', {
      description: 'This ends the room for everyone.',
      confirmPhrase: 'END',
      confirmPrompt: <>Type <strong>END</strong> to confirm</>,
      confirmLabel: 'End session',
      onConfirm: () => navigate(ROUTES.LANDING),
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
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 pt-4">
        {/* Top card = the marquee. The room code is the hero: the host's one job is to share it. */}
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
          {players.length === 0 ? <p className="py-3 text-center font-sans text-[13px] text-ink-3">Waiting for players to join…</p> : null}
        </Card>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Games</h2>

          {queue.length === 0 ? (
            <p className="font-sans text-[14px] text-ink-3">No game picked yet. Choose one to get started.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map((q) => {
                const g = gameById(q.gameId);
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

          <Button variant={queue.length === 0 ? 'primary' : 'secondary'} size="lg" className="w-full" onClick={() => go(ROUTES.HOST_CATALOGUE, { code })}>
            {queue.length === 0 ? 'Pick a game' : 'Add another game'}
          </Button>

          {queue.length >= 2 ? (
            <Button variant="celebrate" size="lg" className="w-full" loading={startLeague.isPending} onClick={startLeagueRun}>
              Start league ({queue.length} games)
            </Button>
          ) : null}
        </Card>

        {/* Waiting state — gives the host something to look at + the scannable join path while
            players trickle in (fills the lower viewport without adding chrome noise). */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-4 text-center">
          <QrCode url={joinUrl(code)} size={132} />
          <p className="max-w-[36ch] font-sans text-[13px] leading-[1.5] text-ink-3">
            Players join at <span className="font-bold text-ink-2">gbedity.app</span> with this code — or scan.
          </p>
          <div className="flex items-center gap-1" aria-label="Waiting for players">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
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
