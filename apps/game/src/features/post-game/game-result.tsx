import { useEffect, useRef, useState } from 'react';

import { Button, Card, LeaderboardRows, OrangeWinnerBar, Score, type LeaderboardEntry } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { useLobby } from '../../shared/api/use-lobby.ts';
import { ROUTES, pathWith } from '../../shared/constants/routes.ts';
import { resultStore } from '../../shared/services/result-store.ts';
import { sessionStore } from '../../shared/services/session-store.ts';
import { seatForIndex } from '../lobby/seat.ts';
import { AppHeader } from '../../shared/widgets/app-header.tsx';

// The real end-of-game result, shared by host + player. Reads the final board the socket stashed at
// game-over (result-store), resolves names from the lobby roster, and shows a "Go to lobby" button
// with a 15s countdown that auto-returns to the lobby. The room stays open (back to lobby), so the
// next game can start from there.

const AUTO_LOBBY_SECONDS = 15;

interface GameResultProps {
  readonly code: string;
  /** host → host lobby, player → player lobby. */
  readonly lobbyRoute: string;
}

export function GameResult({ code, lobbyRoute }: GameResultProps) {
  const navigate = useNavigate();
  const lobby = useLobby(code, code !== '', false);
  const snapshot = resultStore.get(code);
  const myId = sessionStore.getPlayer()?.playerId ?? sessionStore.getHost()?.hostId;
  const [seconds, setSeconds] = useState(AUTO_LOBBY_SECONDS);

  const goToLobby = (): void => {
    resultStore.clear(code);
    navigate(pathWith(lobbyRoute, { code }));
  };
  // Keep the latest goToLobby in a ref so the 1s countdown effect depends only on `seconds` (this
  // project's eslint has no react-hooks plugin, so we avoid the exhaustive-deps suppression).
  const goRef = useRef(goToLobby);
  goRef.current = goToLobby;

  // 15s auto-return countdown.
  useEffect(() => {
    if (seconds <= 0) {
      goRef.current();
      return undefined;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? 'Player';
  const rows = [...(snapshot?.rows ?? [])]
    .map((r) => ({
      playerId: r.playerId,
      name: r.name ?? (r.playerId !== undefined ? nameOf(r.playerId) : '—'),
      score: r.score,
    }))
    .sort((a, b) => b.score - a.score);

  // No winner when nobody scored (top score is 0) — don't crown a 0-point "winner".
  const winner = rows[0] !== undefined && rows[0].score > 0 ? rows[0] : undefined;
  const myRank = myId !== undefined ? rows.findIndex((r) => r.playerId === myId) : -1;
  const me = myRank >= 0 ? rows[myRank] : undefined;
  const entries: LeaderboardEntry[] = rows.map((r, i) => ({ name: r.name, seat: seatForIndex(i), score: r.score }));

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-8">
        {/* Your standing (when the viewer is a ranked player). A 0 score never reads as "You won" —
            rank 1 with no points means nobody actually scored. */}
        {me !== undefined ? (
          <Card size="lg" className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">{rankLabel(myRank + 1, me.score)}</h1>
            <Score value={me.score} size="lg" tone="ink" unit="pts" />
          </Card>
        ) : null}

        {/* The full final board (the real scores of everyone). */}
        <Card size="lg" className="flex flex-col gap-4">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Final scores</h2>
          {rows.length === 0 ? (
            <p className="py-4 text-center font-sans text-[14px] text-ink-3">No scores to show.</p>
          ) : (
            <>
              {winner !== undefined ? <OrangeWinnerBar name={winner.name} seat={seatForIndex(0)} score={winner.score} label="Winner" /> : null}
              <LeaderboardRows entries={entries} />
            </>
          )}
        </Card>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={goToLobby}>
            Go to lobby · {seconds}s
          </Button>
          <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>Leave session</Button>
        </div>
      </main>
    </div>
  );
}

function rankLabel(rank: number, score: number): string {
  // No points → nobody really "won" or placed; keep it neutral.
  if (score <= 0) return 'No points this time';
  if (rank === 1) return 'You won';
  const suffix = rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
  return `You came ${rank}${suffix}`;
}
