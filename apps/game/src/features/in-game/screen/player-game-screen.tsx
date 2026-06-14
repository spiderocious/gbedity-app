import { useEffect, useState } from 'react';

import { Card, Pill, Segmented } from '@gbedity/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { findGame, useCatalogue, useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameKey } from '../../../shared/games/games-manifest.ts';
import { useLobby } from '../../../shared/api/use-lobby.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket, ConnectionStatus } from '../../../shared/realtime/room-socket-context.tsx';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { log, useLogMount } from '../../../shared/observability/logger.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import { getLiveRenderer } from '../live/live-renderers.tsx';
import { getGameFlow } from '../flow/flow-registry.tsx';
import '../flow/register-flows.ts';
import { resolveMockGame, useLatchedLiveGame } from '../resolve-live-game.ts';
import { WaitingForRound } from '../widgets/waiting-for-round.tsx';
import { MpAudience, MpGameId, MpMissingLettersScreen } from '../../games/missing-letters/multiplayer/index.ts';
import { MpAudience as WsAudience, MpGameId as WsGameId, MpWordshotScreen } from '../../games/wordshot/multiplayer/index.ts';
import { MpAudience as MmAudience, MpGameId as MmGameId, MpMillionaireScreen } from '../../games/millionaire/multiplayer/index.ts';

// §5.3 — player in-game. LIVE by default: connects the room socket, renders the player patch,
// sends client.action. `?mock=<catalogueId>` opts into the static preview registry (the 13
// non-backed games + the /preview-screens gallery).
export function PlayerGameScreen() {
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const mockId = resolveMockGame(search.get('mock'));

  if (mockId !== undefined) {
    return <MockPlayer code={code} mockId={mockId} />;
  }

  const player = sessionStore.getPlayer();
  return (
    <RoomSocketProvider
      roomCode={code}
      role={SocketRole.PLAYER}
      {...(player?.playerId !== undefined ? { playerId: player.playerId } : {})}
      {...(player?.reconnectToken !== undefined ? { reconnectToken: player.reconnectToken } : {})}
    >
      <LivePlayer code={code} hint={search.get('live')} />
    </RoomSocketProvider>
  );
}

function LivePlayer({ code, hint }: { readonly code: string; readonly hint: string | null }) {
  useLogMount('LivePlayer', { code, hint });
  const navigate = useNavigate();
  const { patch, status, sendAction, gameOver } = useRoomSocket();

  // Game identity comes from the patch shape once it arrives; the ?live= hint covers the gap before
  // the first patch. Latched so a board-only / transitional patch can't drop the id and remount the
  // flow mid-game (which would reset its stage machine → "question flash → 3·2·1 → stuck on Go!").
  const backendId = useLatchedLiveGame(patch, hint);
  // New self-contained slices own their whole surface (incl. game-over nav). Until every game is
  // migrated, the generic screen branches to the new slice by backend id and skips its own flow path.
  const isNewSlice = backendId === MpGameId.MISSING_LETTERS || backendId === WsGameId.WORDSHOT || backendId === MmGameId.MILLIONAIRE;

  // Game ended → leave the play surface for the result screen (the room stays open / back to lobby).
  // New-slice games handle their own game-over navigation, so skip it here for them.
  useEffect(() => {
    if (gameOver && !isNewSlice) navigate(pathWith(ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isNewSlice, code, navigate]);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  const score = typeof patch?.yourScore === 'number' ? patch.yourScore : 0;
  const isBoard =
    patch !== null && (patch.phase === Phase.REVEAL || patch.phase === Phase.LEADERBOARD || patch.phase === Phase.DONE);

  // Chrome for the waiting beat: game title (catalogue join by backend id) + roster (lobby snapshot).
  const { data: catalogue } = useCatalogue();
  const waitingTitle = (backendId ? findGame(catalogue ?? [], backendId)?.title : undefined) ?? 'The round';
  const lobby = useLobby(code, code !== '', false);
  const roster = (lobby.data?.players ?? []).filter((p) => !p.spectator).map((p) => ({ id: p.id, name: p.nickname }));

  // SPECTATOR guard: a player who opted to spectate belongs on the DISPLAY (TV) loop, not the play
  // surface. If they land here (e.g. a direct refresh on the player game URL), send them across.
  const myId = sessionStore.getPlayer()?.playerId;
  const amSpectator = lobby.data?.players.find((p) => p.id === myId)?.spectator === true;
  useEffect(() => {
    if (amSpectator) navigate(pathWith(ROUTES.DISPLAY_GAME, { code }));
  }, [amSpectator, code, navigate]);

  // New self-contained slices: render the game's own multiplayer surface instead of the old flow.
  // Each consumes the same useRoomSocket() this provider supplies — just a different renderer.
  if (backendId === MpGameId.MISSING_LETTERS && !amSpectator) {
    return (
      <div className="min-h-screen bg-canvas">
        <MpMissingLettersScreen audience={MpAudience.PLAYER} code={code} />
      </div>
    );
  }
  if (backendId === WsGameId.WORDSHOT && !amSpectator) {
    return (
      <div className="min-h-screen bg-canvas">
        <MpWordshotScreen audience={WsAudience.PLAYER} code={code} />
      </div>
    );
  }
  if (backendId === MmGameId.MILLIONAIRE && !amSpectator) {
    return (
      <div className="min-h-screen bg-canvas">
        <MpMillionaireScreen audience={MmAudience.PLAYER} code={code} />
      </div>
    );
  }

  // Games with a dedicated animated flow own the play surface (intro plays even before the first
  // patch arrives). Resolved from the registry by backend gameId.
  const Flow = getGameFlow(backendId);
  log.event(LogEvent.FLOW_RESOLVED, { audience: 'player', backendId, hasFlow: Flow !== undefined, hasPatch: patch !== null, status }, { component: 'LivePlayer' });

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-6 pt-2">
        {status === ConnectionStatus.RECONNECTING ? (
          <Card size="lg" className="text-center">
            <p className="font-sans text-[14px] text-warn-deep">Reconnecting…</p>
          </Card>
        ) : null}
        {Flow !== undefined ? (
          <Flow patch={patch} send={sendAction} audience="player" code={code} />
        ) : patch === null && status === ConnectionStatus.ERROR ? (
          <Card size="lg">
            <p className="text-center font-sans text-[15px] text-ink-3">Couldn’t join this game.</p>
          </Card>
        ) : patch === null ? (
          // Designed waiting beat — not a tiny loading card. (Spec: Screen 2.)
          <WaitingForRound title={waitingTitle} players={roster} />
        ) : (
        <Card size="lg">
          {isBoard ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="font-serif text-[20px] font-semibold text-ink">
                {patch.phase === Phase.DONE ? 'That’s a wrap' : 'Round over'}
              </p>
              <p className="font-sans text-[14px] text-ink-3">
                You scored <span className="font-bold text-ink">{score}</span> — full standings on the shared screen.
              </p>
            </div>
          ) : renderer !== undefined ? (
            // Rendered as a component (not a call) so its hooks live in a stable fiber; the
            // game key remounts cleanly if the live game changes.
            <renderer.Player key={backendId} patch={patch} send={sendAction} />
          ) : (
            <p className="text-center font-sans text-[15px] text-ink-3">Waiting for your turn…</p>
          )}
        </Card>
        )}
      </main>
    </div>
  );
}

const PlayerState = { ACTIVE: 'Active', WAITING: 'Waiting', SPECTATOR: 'Spectating' } as const;
type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

function MockPlayer({ code, mockId }: { readonly code: string; readonly mockId: number }) {
  const { game } = useCatalogueGame(mockId);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const [state, setState] = useState<PlayerState>(PlayerState.ACTIVE);
  if (game === undefined || content === undefined) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} right={<Pill tone="action">You: 320 pts</Pill>} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        <Segmented
          value={state}
          onChange={setState}
          ariaLabel="Preview player state"
          options={[PlayerState.ACTIVE, PlayerState.WAITING, PlayerState.SPECTATOR].map((s) => ({ value: s, label: s }))}
        />
        {state === PlayerState.ACTIVE ? (
          <Card size="lg">{content.renderPlayer()}</Card>
        ) : state === PlayerState.WAITING ? (
          <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-serif text-[20px] font-semibold text-ink">Wait for your turn</p>
            <div className="flex gap-1" aria-label="Waiting">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </Card>
        ) : (
          <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
            <Pill tone="info">Spectating this round</Pill>
            <p className="font-sans text-[14px] text-ink-3">You&apos;re over the cap for this game. Watch the shared screen — you&apos;re back next round.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
