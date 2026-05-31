import { useState } from 'react';

import { Card, Pill, Segmented } from '@gbedity/ui';
import { useParams, useSearchParams } from 'react-router-dom';

import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameById } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket, ConnectionStatus } from '../../../shared/realtime/room-socket-context.tsx';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { getLiveRenderer } from '../live/live-renderers.tsx';
import { resolveLiveGame, type LiveGame } from '../resolve-live-game.ts';
import { useGameParam } from '../use-game-param.ts';

// §5.3 — player in-game. Live games render the player patch + send client.action; mock games
// keep the static input + the active/waiting/spectator preview toggle.
export function PlayerGameScreen() {
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const live = resolveLiveGame(search.get('live'));

  if (live !== undefined) {
    const player = sessionStore.getPlayer();
    return (
      <RoomSocketProvider
        roomCode={code}
        role={SocketRole.PLAYER}
        {...(player?.playerId !== undefined ? { playerId: player.playerId } : {})}
        {...(player?.reconnectToken !== undefined ? { reconnectToken: player.reconnectToken } : {})}
      >
        <LivePlayer live={live} code={code} />
      </RoomSocketProvider>
    );
  }
  return <MockPlayer code={code} />;
}

function LivePlayer({ live, code }: { readonly live: LiveGame; readonly code: string }) {
  const { patch, status, sendAction } = useRoomSocket();
  const renderer = getLiveRenderer(live.backendId);
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
            <p className="text-center font-sans text-[15px] text-ink-3">Waiting for the round…</p>
          ) : isBoard ? (
            <p className="text-center font-serif text-[20px] font-semibold text-ink">Round over — check the shared screen.</p>
          ) : (
            renderer?.player(patch, sendAction) ?? <p className="text-center font-sans text-[15px] text-ink-3">Waiting…</p>
          )}
        </Card>
      </main>
    </div>
  );
}

const PlayerState = { ACTIVE: 'Active', WAITING: 'Waiting', SPECTATOR: 'Spectating' } as const;
type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

function MockPlayer({ code }: { readonly code: string }) {
  const id = useGameParam();
  const game = gameById(id);
  const content = game ? getGameContent(game.key) : undefined;
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
