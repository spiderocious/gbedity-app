import { GameId } from '@gbedity/ui';
import { useParams, useSearchParams } from 'react-router-dom';

import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameById, type GameCategory } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket } from '../../../shared/realtime/room-socket-context.tsx';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { getLiveRenderer, LiveBoard } from '../live/live-renderers.tsx';
import { resolveLiveGame, type LiveGame } from '../resolve-live-game.ts';
import { useGameParam } from '../use-game-param.ts';

// §5.1 — display in-game. Live games (5 backed, ?live=<backendId>) render from server.view
// over a display socket; the 13 mock games render the static registry by ?game= id.
export function DisplayGameScreen() {
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const live = resolveLiveGame(search.get('live'));

  if (live !== undefined) {
    return (
      <RoomSocketProvider roomCode={code} role={SocketRole.DISPLAY}>
        <LiveDisplay live={live} />
      </RoomSocketProvider>
    );
  }
  return <MockDisplay />;
}

function LiveDisplay({ live }: { readonly live: LiveGame }) {
  const { patch, status } = useRoomSocket();
  const renderer = getLiveRenderer(live.backendId);
  const isBoard =
    patch !== null && (patch.phase === Phase.REVEAL || patch.phase === Phase.LEADERBOARD || patch.phase === Phase.DONE);

  return (
    <Shell id={live.id} category={live.category} title={live.title} round={patch?.phase ?? status}>
      {patch === null ? (
        <p className="text-center font-sans text-[16px] text-ink-3">Setting up…</p>
      ) : isBoard ? (
        <LiveBoard patch={patch} />
      ) : (
        renderer?.display(patch) ?? <LiveBoard patch={patch} />
      )}
    </Shell>
  );
}

function MockDisplay() {
  const id = useGameParam();
  const game = gameById(id);
  const content = game ? getGameContent(game.key) : undefined;
  if (game === undefined || content === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="font-sans text-[15px] text-ink-3">No active game.</p>
      </div>
    );
  }
  return (
    <Shell id={game.id} category={game.category} title={game.title} round="Round 2 · 3 left">
      {content.renderDisplay()}
    </Shell>
  );
}

interface ShellProps {
  readonly id: number;
  readonly category: GameCategory;
  readonly title: string;
  readonly round: string;
  readonly children: React.ReactNode;
}

function Shell({ id, category, title, round, children }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-10 py-5">
        <div className="flex items-center gap-3">
          <GameId id={id} category={category} size="sm" />
          <span className="font-serif text-[20px] font-semibold text-ink">{title}</span>
        </div>
        <span className="font-sans text-[15px] font-bold text-ink-3">{round}</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-10 pb-6">
        <div className="w-full max-w-2xl rounded-card-lg bg-surface p-10">{children}</div>
      </main>
      <footer className="px-10 py-4 text-center font-sans text-[13px] text-ink-3">Host controls on phone</footer>
    </div>
  );
}
