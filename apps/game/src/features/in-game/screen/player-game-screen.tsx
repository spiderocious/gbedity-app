import { useState } from 'react';

import { Card, Pill, Segmented } from '@gbedity/ui';
import { useParams, useSearchParams } from 'react-router-dom';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameKey } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket, ConnectionStatus } from '../../../shared/realtime/room-socket-context.tsx';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { getLiveRenderer } from '../live/live-renderers.tsx';
import { detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';

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
  const { patch, status, sendAction } = useRoomSocket();
  // Game identity comes from the patch shape once it arrives; the ?live= hint covers the gap
  // before the first patch (so chrome can show a title), but detection is the real source.
  const backendId = detectLiveGame(patch) ?? resolveLiveHint(hint);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  const score = typeof patch?.yourScore === 'number' ? patch.yourScore : 0;
  const isBoard =
    patch !== null && (patch.phase === Phase.REVEAL || patch.phase === Phase.LEADERBOARD || patch.phase === Phase.DONE);

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} right={<Pill tone="action">You: {score} pts</Pill>} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        {status === ConnectionStatus.RECONNECTING ? (
          <Card size="lg" className="text-center">
            <p className="font-sans text-[14px] text-warn-deep">Reconnecting…</p>
          </Card>
        ) : null}
        <Card size="lg">
          {patch === null ? (
            <p className="text-center font-sans text-[15px] text-ink-3">
              {status === ConnectionStatus.ERROR ? 'Couldn’t join this game.' : 'Waiting for the round to start…'}
            </p>
          ) : isBoard ? (
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
