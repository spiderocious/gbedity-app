import { useRef } from 'react';

import { GameId } from '@gbedity/ui';
import { useParams, useSearchParams } from 'react-router-dom';

import { findGame, useCatalogue, useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameCategory, type GameKey } from '../../../shared/games/games-manifest.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket } from '../../../shared/realtime/room-socket-context.tsx';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase, type ViewPatch } from '../../../shared/types/view.ts';
import { getLiveRenderer, LiveBoard } from '../live/live-renderers.tsx';
import { LiveResult } from '../live/live-result.tsx';
import { getGameFlow } from '../flow/flow-registry.tsx';
import '../flow/register-flows.ts';
import { detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';
import { MpAudience, MpGameId, MpMissingLettersScreen } from '../../games/missing-letters/multiplayer/index.ts';
import { MpAudience as WsAudience, MpGameId as WsGameId, MpWordshotScreen } from '../../games/wordshot/multiplayer/index.ts';
import { MpAudience as MmAudience, MpGameId as MmGameId, MpMillionaireScreen } from '../../games/millionaire/multiplayer/index.ts';
import { MpAudience as InvAudience, MpGameId as InvGameId, MpInvestigationScreen } from '../../games/investigation/multiplayer/index.ts';

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
  const { patch, status, gameOver } = useRoomSocket();

  // The display/spectator surface is a HANDS-FREE LOOP — a TV can be left on it:
  //   spectating a game → game ends → hold the final result board → host starts the next game →
  //   the fresh live patch resets gameOver (in the socket provider) → resume spectating. We NEVER
  //   navigate away on game-over (that dropped to a mock result + broke the loop). A true session end
  //   (the room was ended) flips the socket to ENDED → the provider renders the closed screen for us.
  const backendId = detectLiveGame(patch) ?? resolveLiveHint(hint);
  const renderer = backendId ? getLiveRenderer(backendId) : undefined;
  // Chrome (id/title/category) joined from the central catalogue store by backend gameId.
  const { data } = useCatalogue();
  const game = backendId ? findGame(data ?? [], backendId) : undefined;
  // Hold the result board when the game is over (the latch) OR the terminal phase is showing — until
  // the next game's first live patch arrives (which clears gameOver and swaps in a live phase).
  const isFinal = gameOver || (patch !== null && (patch.phase === Phase.LEADERBOARD || patch.phase === Phase.DONE));
  const isReveal = patch !== null && patch.phase === Phase.REVEAL;

  // Keep the freshest board-bearing patch so the held result survives a between-games LOBBY patch
  // (which carries no board) — otherwise the board would flash to "Tallying…" while we wait.
  const lastBoardPatch = useRef<ViewPatch | null>(null);
  if (patch !== null && Array.isArray(patch.board) && patch.board.length > 0) lastBoardPatch.current = patch;
  const resultPatch = patch !== null && Array.isArray(patch.board) && patch.board.length > 0 ? patch : lastBoardPatch.current;

  // Games with a dedicated animated flow render as a SPECTATOR (read-only, no input) — the same
  // sequence players see, sized for the shared screen. Resolved from the registry by backend gameId.
  // While holding the final result we don't hand the patch to the flow (it would re-run its intro).
  const Flow = getGameFlow(backendId);

  // New self-contained slices: render the game's spectator surface during live play. The display
  // keeps its hands-free loop — when the game ends we still hold the final board via LiveResult
  // (isFinal), and the next game's first live patch resumes the slice.
  if (backendId === MpGameId.MISSING_LETTERS && !isFinal) {
    return <MpMissingLettersScreen audience={MpAudience.SPECTATOR} code={code} />;
  }
  if (backendId === WsGameId.WORDSHOT && !isFinal) {
    return <MpWordshotScreen audience={WsAudience.SPECTATOR} code={code} />;
  }
  if (backendId === MmGameId.MILLIONAIRE && !isFinal) {
    return <MpMillionaireScreen audience={MmAudience.SPECTATOR} code={code} />;
  }
  if (backendId === InvGameId.INVESTIGATION && !isFinal) {
    return <MpInvestigationScreen audience={InvAudience.SPECTATOR} code={code} />;
  }

  return (
    <Shell
      id={game?.id ?? 0}
      category={game?.category ?? 'casual'}
      title={game?.title ?? 'Game'}
      round={isFinal ? 'Final scores' : (patch?.phase ?? status)}
    >
      {isFinal && resultPatch !== null ? (
        <LiveResult patch={resultPatch} code={code} />
      ) : Flow !== undefined ? (
        // Keyed by game id so a new game in the loop remounts the flow cleanly (fresh intro), rather
        // than reusing the previous game's stage machine.
        <Flow key={backendId} patch={patch} send={() => undefined} audience="spectator" code={code} />
      ) : patch === null ? (
        <p className="text-center font-sans text-[16px] text-ink-3">Setting up…</p>
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
