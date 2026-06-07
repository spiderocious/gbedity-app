import { GameId } from '@gbedity/ui';
import { useParams, useSearchParams } from 'react-router-dom';

import { findGame, useCatalogue, useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameCategory, type GameKey } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket } from '../../../shared/realtime/room-socket-context.tsx';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { getLiveRenderer, LiveBoard } from '../live/live-renderers.tsx';
import { LiveResult } from '../live/live-result.tsx';
import { detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';

// §5.1 — display in-game. LIVE by default: a display socket renders server.view patches.
// `?mock=<catalogueId>` opts into the static registry (the 13 non-backed games + the gallery).
export function DisplayGameScreen() {
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const mockId = resolveMockGame(search.get('mock'));

  if (mockId !== undefined) {
    return <MockDisplay mockId={mockId} />;
  }
  return (
    <RoomSocketProvider roomCode={code} role={SocketRole.DISPLAY}>
      <LiveDisplay code={code} hint={search.get('live')} />
    </RoomSocketProvider>
  );
}

function LiveDisplay({ code, hint }: { readonly code: string; readonly hint: string | null }) {
  const { patch, status } = useRoomSocket();
  const backendId = detectLiveGame(patch) ?? resolveLiveHint(hint);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  // Chrome (id/title/category) joined from the central catalogue store by backend gameId.
  const { data } = useCatalogue();
  const game = backendId ? findGame(data ?? [], backendId) : undefined;
  // End-of-game → the full live result board; in-round reveal → the live (partial) board.
  const isFinal = patch !== null && (patch.phase === Phase.LEADERBOARD || patch.phase === Phase.DONE);
  const isReveal = patch !== null && patch.phase === Phase.REVEAL;

  return (
    <Shell
      id={game?.id ?? 0}
      category={game?.category ?? 'casual'}
      title={game?.title ?? 'Game'}
      round={patch?.phase ?? status}
    >
      {patch === null ? (
        <p className="text-center font-sans text-[16px] text-ink-3">Setting up…</p>
      ) : isFinal ? (
        <LiveResult patch={patch} code={code} />
      ) : isReveal ? (
        <LiveBoard patch={patch} code={code} />
      ) : (
        renderer?.display(patch) ?? <LiveBoard patch={patch} code={code} />
      )}
    </Shell>
  );
}

function MockDisplay({ mockId }: { readonly mockId: number }) {
  const { game } = useCatalogueGame(mockId);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
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
