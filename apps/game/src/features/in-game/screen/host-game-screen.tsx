import { Button, Card, DrawerService, GameId, Pill } from '@gbedity/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameKey } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket, ConnectionStatus } from '../../../shared/realtime/room-socket-context.tsx';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Audience, Phase } from '../../../shared/types/view.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { getLiveRenderer } from '../live/live-renderers.tsx';
import { detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';

// §5.2 — host in-game. LIVE by default: the host joins as role=host (its seat is also a
// player), plays off the PLAYER-audience projection, AND drives host controls. `?mock=<id>`
// opts into the static preview (gallery + "Play again"). Fixes F-1/F-2: the host no longer
// lands on the display surface and now has a real play+control screen.
export function HostGameScreen() {
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const mockId = resolveMockGame(search.get('mock'));

  if (mockId !== undefined) {
    return <MockHost code={code} mockId={mockId} />;
  }

  const player = sessionStore.getPlayer();
  const reconnectToken = sessionStore.getHost()?.hostToken ?? player?.reconnectToken;
  return (
    <RoomSocketProvider
      roomCode={code}
      role={SocketRole.HOST}
      {...(reconnectToken !== undefined ? { reconnectToken } : {})}
      {...(player?.playerId !== undefined ? { playerId: player.playerId } : {})}
    >
      <LiveHost code={code} hint={search.get('live')} />
    </RoomSocketProvider>
  );
}

function LiveHost({ code, hint }: { readonly code: string; readonly hint: string | null }) {
  const navigate = useNavigate();
  const { patches, patch, status, sendAction } = useRoomSocket();
  // The host plays off its PLAYER-audience projection (it's a player seat); the host-audience
  // patch (if any) is kept separate by the F-3 fix and reserved for host-only chrome.
  const playPatch = patches[Audience.PLAYER] ?? patch ?? null;
  const backendId = detectLiveGame(playPatch) ?? resolveLiveHint(hint);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  const score = typeof playPatch?.yourScore === 'number' ? playPatch.yourScore : 0;
  const isBoard =
    playPatch !== null &&
    (playPatch.phase === Phase.REVEAL || playPatch.phase === Phase.LEADERBOARD || playPatch.phase === Phase.DONE);

  function endGame() {
    DrawerService.confirm('End the game now?', {
      description: 'Current scores will count.',
      confirmLabel: 'End game',
      cancelLabel: 'Keep playing',
      destructive: true,
      onConfirm: () => sendAction({ type: 'host.end_game' }),
    });
  }

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        {status === ConnectionStatus.RECONNECTING ? (
          <Card size="lg" className="text-center">
            <p className="font-sans text-[14px] text-warn-deep">Reconnecting…</p>
          </Card>
        ) : null}

        {/* Host plays here — the same live input any player gets. */}
        <Card size="lg">
          {playPatch === null ? (
            <p className="text-center font-sans text-[15px] text-ink-3">
              {status === ConnectionStatus.ERROR ? 'Couldn’t join this game.' : 'Starting the round…'}
            </p>
          ) : isBoard ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="font-serif text-[20px] font-semibold text-ink">
                {playPatch.phase === Phase.DONE ? 'That’s a wrap' : 'Round over'}
              </p>
              <p className="font-sans text-[14px] text-ink-3">Full standings on the shared screen.</p>
            </div>
          ) : renderer !== undefined ? (
            <renderer.Player key={backendId} patch={playPatch} send={sendAction} />
          ) : (
            <p className="text-center font-sans text-[15px] text-ink-3">Waiting for the round…</p>
          )}
        </Card>

        {/* Host-only controls — real actions emitted to the room (engine applies what it supports). */}
        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Host controls</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => sendAction({ type: 'host.skip' })}>Skip</Button>
            <Button variant="secondary" onClick={() => navigate(pathWith(ROUTES.DISPLAY_LOBBY, { code }))}>Open display</Button>
            <Button variant="danger" className="col-span-2" onClick={endGame}>End game</Button>
          </div>
          <p className="font-sans text-[11px] text-ink-4">
            Actions are sent to the room; the engine applies the ones it supports.
          </p>
        </Card>
      </main>
    </div>
  );
}

function MockHost({ code, mockId }: { readonly code: string; readonly mockId: number }) {
  const { game } = useCatalogueGame(mockId);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const navigate = useNavigate();
  if (game === undefined || content === undefined) return null;
  const gameId = game.id;

  function endGame() {
    DrawerService.confirm('End the game now?', {
      description: 'Current scores will count.',
      confirmLabel: 'End game',
      cancelLabel: 'Keep playing',
      destructive: true,
      onConfirm: () => navigate(`${pathWith(ROUTES.HOST_RESULT, { code })}?mock=${gameId}`),
    });
  }

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <AppHeader roomCode={code} right={<span className="font-sans text-[13px] font-bold text-ink-3">Preview</span>} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        <Card size="lg" className="flex items-center gap-3">
          <GameId id={game.id} category={game.category} size="sm" />
          <span className="font-serif text-[20px] font-semibold text-ink">{game.title}</span>
        </Card>
        <Card size="lg">{content.renderPlayer()}</Card>
        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Host controls</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => DrawerService.toast('Skip (preview)', { tone: 'default' })}>Skip</Button>
            <Button variant="danger" onClick={endGame}>End game</Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
