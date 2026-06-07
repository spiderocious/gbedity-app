import { useEffect } from 'react';

import { Button, DrawerService, Logo, PlayerPill, QrCode, RoomCodeChip } from '@gbedity/ui';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useLobby } from '../../../shared/api/use-lobby.ts';
import { useStartGame } from '../../../shared/api/use-start-game.ts';
import { ROUTES, joinUrl, pathWith } from '../../../shared/constants/routes.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket } from '../../../shared/realtime/room-socket-context.tsx';
import { ApiError } from '../../../shared/services/api-error.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { SocketRole } from '../../../shared/services/socket.ts';
import { useGameQueue } from '../../../shared/games/game-queue.ts';
import { LiveGameId } from '../../in-game/resolve-live-game.ts';
import { Phase } from '../../../shared/types/view.ts';
import { LineupSummary } from '../../../shared/widgets/lineup-summary.tsx';
import { seatForIndex } from '../seat.ts';

// §2.1 — display lobby (landscape, large text). Live roster from GET /rooms/:code; the
// display socket auto-advances to the display game when the host starts. A host-control
// strip (this device is also the host) starts a game directly via POST /rooms/:code/start.
export function DisplayLobbyScreen() {
  const { code = '' } = useParams();
  return (
    <RoomSocketProvider roomCode={code} role={SocketRole.DISPLAY}>
      <DisplayLobbyContent code={code} />
    </RoomSocketProvider>
  );
}

function DisplayLobbyContent({ code }: { readonly code: string }) {
  const navigate = useNavigate();
  const lobby = useLobby(code);
  const { patch } = useRoomSocket();
  const startGame = useStartGame();
  const host = sessionStore.getHost();
  const queue = useGameQueue(code);
  const players = lobby.data?.players ?? [];
  const lineup = lobby.data?.lineup ?? [];
  // The first BACKED game the host queued; falls back to Wordshot only if nothing's queued.
  const nextBacked = queue.find((q) => q.backendId !== undefined);
  const nextGameId = nextBacked?.backendId ?? LiveGameId.WORDSHOT;

  useEffect(() => {
    if (patch !== null && patch.phase !== Phase.LOBBY) {
      navigate(`${pathWith(ROUTES.DISPLAY_GAME, { code })}?live=${nextGameId}`);
    }
  }, [patch, code, navigate, nextGameId]);

  function start() {
    if (host === undefined) {
      // Not the host on this device — just preview the display game shell.
      navigate(pathWith(ROUTES.DISPLAY_GAME, { code }));
      return;
    }
    // Launch the host's queued game (F-5) — not a hardcoded Wordshot.
    startGame.mutate(
      { code, hostId: host.hostId, gameId: nextGameId, config: nextBacked?.config ?? {} },
      {
        onSuccess: () => navigate(`${pathWith(ROUTES.DISPLAY_GAME, { code })}?live=${nextGameId}`),
        onError: (e) => DrawerService.toast(e instanceof ApiError ? e.message : 'Could not start.', { tone: 'danger' }),
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-10 py-6">
        <Logo size="lg" />
        <RoomCodeChip code={code} size="lg" />
        <span className="font-sans text-[14px] font-bold text-ink-3">How players join</span>
      </header>

      <div className="flex flex-1 gap-10 px-10 pb-6">
        <main className="flex flex-1 flex-col items-center justify-center gap-6">
          <QrCode url={joinUrl(code)} size={240} className="border-2 border-action" />
          <RoomCodeChip code={code} size="hero" />
          <p className="max-w-[44ch] text-center font-sans text-[20px] leading-[1.5] text-ink-3">
            Open gbedity.app on your phone and enter the code — or scan.
          </p>
        </main>

        <aside className="flex w-[340px] flex-col gap-3">
          <h2 className="font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Players</h2>
          {players.map((p, i) => (
            <PlayerPill key={p.id} name={p.nickname} avatarId={p.id} seat={seatForIndex(i)} size="lg" />
          ))}
          {players.length === 0 ? <p className="font-sans text-[15px] text-ink-3">Waiting for the first player…</p> : null}

          {lineup.length > 0 ? (
            <div className="mt-4">
              <h2 className="mb-2 font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                Lineup
              </h2>
              <LineupSummary lineup={lineup} scale="display" />
            </div>
          ) : null}
        </aside>
      </div>

      <footer className="flex items-center justify-between gap-4 bg-surface px-10 py-5">
        <span className="font-serif text-[24px] font-semibold text-ink">
          Waiting for players · {players.length} joined
        </span>
        <div className="flex items-center gap-3">
          <Link to={pathWith(ROUTES.HOST_LOBBY, { code })} className="font-sans text-[14px] font-bold text-ink-3 hover:text-ink">
            Configure
          </Link>
          <Button variant="primary" loading={startGame.isPending} onClick={start}>
            Start game
          </Button>
        </div>
      </footer>
    </div>
  );
}
