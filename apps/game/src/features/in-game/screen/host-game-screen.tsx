import { useEffect } from 'react';

import { Card, DrawerService, GameId, Pill } from '@gbedity/ui';
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
import { log, useLogMount } from '../../../shared/observability/logger.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import { getLiveRenderer } from '../live/live-renderers.tsx';
import { getGameFlow } from '../flow/flow-registry.tsx';
import '../flow/register-flows.ts';
import { hostControlsFor } from '../host-controls.ts';
import { resolveMockGame, useLatchedLiveGame } from '../resolve-live-game.ts';
import { HostAction } from '../../../shared/services/socket.ts';
import { HostControlStrip } from '../widgets/host-control-strip.tsx';
import { MpAudience, MpGameId, MpMissingLettersScreen } from '../../games/missing-letters/multiplayer/index.ts';
import { MpAudience as WsAudience, MpGameId as WsGameId, MpWordshotScreen } from '../../games/wordshot/multiplayer/index.ts';
import { MpAudience as MmAudience, MpGameId as MmGameId, MpMillionaireScreen } from '../../games/millionaire/multiplayer/index.ts';
import { MpAudience as InvAudience, MpGameId as InvGameId, MpInvestigationScreen } from '../../games/investigation/multiplayer/index.ts';

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
  useLogMount('LiveHost', { code, hint });
  const navigate = useNavigate();
  const { patches, status, sendAction, gameOver } = useRoomSocket();

  // The host plays off its PLAYER-audience projection ONLY (it's a player seat). It must NOT fall
  // back to the host-/display-audience patch for the play surface: those carry a different view of
  // the round (e.g. the host-audience word), which is what made the host briefly flash a different
  // question than the players saw. Before the player patch arrives, playPatch is null and the flow
  // shows its own "loading the word" beat — correct. `patch` stays available for host-only chrome.
  const playPatch = patches[Audience.PLAYER] ?? null;
  // Latched: a board-only / transitional patch must not drop the id and remount the flow mid-game.
  const backendId = useLatchedLiveGame(playPatch, hint);
  // New self-contained slices own their surface, game-over nav, and host control strip.
  const isNewSlice = backendId === MpGameId.MISSING_LETTERS || backendId === WsGameId.WORDSHOT || backendId === MmGameId.MILLIONAIRE || backendId === InvGameId.INVESTIGATION;

  // Game ended (natural finish OR the host's End game) → leave the play surface for the result
  // screen. New-slice games handle their own game-over navigation, so skip it here for them.
  useEffect(() => {
    if (gameOver && !isNewSlice) navigate(pathWith(ROUTES.HOST_RESULT, { code }));
  }, [gameOver, isNewSlice, code, navigate]);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  const controls = hostControlsFor(backendId);
  const score = typeof playPatch?.yourScore === 'number' ? playPatch.yourScore : 0;
  const isBoard =
    playPatch !== null &&
    (playPatch.phase === Phase.REVEAL || playPatch.phase === Phase.LEADERBOARD || playPatch.phase === Phase.DONE);

  // New self-contained slices: each carries its own play screens AND host control strip.
  if (backendId === MpGameId.MISSING_LETTERS) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
        <MpMissingLettersScreen audience={MpAudience.HOST} code={code} />
      </div>
    );
  }
  if (backendId === WsGameId.WORDSHOT) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
        <MpWordshotScreen audience={WsAudience.HOST} code={code} />
      </div>
    );
  }
  if (backendId === MmGameId.MILLIONAIRE) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
        <MpMillionaireScreen audience={MmAudience.HOST} code={code} />
      </div>
    );
  }
  if (backendId === InvGameId.INVESTIGATION) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
        <MpInvestigationScreen audience={InvAudience.HOST} code={code} />
      </div>
    );
  }

  // Games with a dedicated animated flow own the WHOLE play surface (intro → countdown → rounds →
  // reveal → scores → done). The host plays through the flow as a player AND keeps the control strip.
  const Flow = getGameFlow(backendId);
  log.event(LogEvent.FLOW_RESOLVED, { audience: 'host', backendId, hasFlow: Flow !== undefined, hasPatch: playPatch !== null, status }, { component: 'LiveHost' });

  // Spec: gameplay is the hero; host controls are a slim sticky utility strip (≤15% of weight), not a
  // dominant card. `endGame` (your confirm flow) is reused as the strip's End-game action.
  return (
    <div className="min-h-screen bg-canvas pb-20">
      <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 pt-2">
        {status === ConnectionStatus.RECONNECTING ? (
          <Card size="lg" className="text-center">
            <p className="font-sans text-[14px] text-warn-deep">Reconnecting…</p>
          </Card>
        ) : null}

        {Flow !== undefined ? (
          <Flow patch={playPatch} send={sendAction} audience="host" code={code} />
        ) : (
          /* Host plays here — the same live input any player gets. */
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
        )}
      </main>

      {/* Host-only controls — real engine-level actions (host-verified server-side). Per-game set
          (host-controls.ts): End game is universal; Skip only for round/timer games. */}
      <HostControlStrip
        controls={controls}
        onSkip={() => sendAction({ type: HostAction.SKIP })}
        onEndGame={() => sendAction({ type: HostAction.END_GAME })}
      />
    </div>
  );
}

function MockHost({ code, mockId }: { readonly code: string; readonly mockId: number }) {
  const { game } = useCatalogueGame(mockId);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const navigate = useNavigate();
  if (game === undefined || content === undefined) return null;
  const gameId = game.id;

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <AppHeader roomCode={code} right={<span className="font-sans text-[13px] font-bold text-ink-3">Preview</span>} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 pt-2">
        <Card size="lg" className="flex items-center gap-3">
          <GameId id={game.id} category={game.category} size="sm" />
          <span className="font-serif text-[20px] font-semibold text-ink">{game.title}</span>
        </Card>
        <Card size="lg">{content.renderPlayer()}</Card>
      </main>

      <HostControlStrip
        controls={{ skip: true }}
        onSkip={() => DrawerService.toast('Skip (preview)', { tone: 'default' })}
        onEndGame={() => navigate(`${pathWith(ROUTES.HOST_RESULT, { code })}?mock=${gameId}`)}
      />
    </div>
  );
}
