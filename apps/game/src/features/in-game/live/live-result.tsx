import { LeaderboardRows, OrangeWinnerBar, type LeaderboardEntry } from '@gbedity/ui';

import { useLobby } from '../../../shared/api/use-lobby.ts';
import { seatForIndex } from '../../lobby/seat.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';

// Live end-of-game board, rendered from the terminal view patch (phase done/leaderboard).
// Resolves player names from the lobby roster when the patch only carries playerIds. This is
// the real result — replaces the mock LEADERBOARD on the live result path (fixes K5).

interface BoardRow {
  readonly name: string;
  readonly score: number;
}

function rowsFromPatch(patch: ViewPatch, nameOf: (id: string) => string): readonly BoardRow[] {
  const raw = patch.board ?? patch.ranked ?? [];
  return raw
    .map((r) => {
      const id = (r as { playerId?: string }).playerId;
      const name = r.name ?? (id !== undefined ? nameOf(id) : undefined) ?? '—';
      const score =
        typeof (r as { points?: number }).points === 'number'
          ? (r as { points: number }).points
          : typeof (r as { score?: number }).score === 'number'
            ? (r as { score: number }).score
            : 0;
      return { name, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function LiveResult({ patch, code }: { readonly patch: ViewPatch; readonly code: string }) {
  const lobby = useLobby(code, true, false);
  const nameOf = (id: string) => lobby.data?.players.find((p) => p.id === id)?.nickname ?? 'Player';
  const rows = rowsFromPatch(patch, nameOf);
  const winner = rows[0];

  if (rows.length === 0) {
    return <p className="text-center font-serif text-[20px] font-semibold text-ink">Tallying the scores…</p>;
  }

  const entries: LeaderboardEntry[] = rows.map((r, i) => ({ name: r.name, seat: seatForIndex(i), score: r.score }));

  return (
    <div className="flex flex-col gap-4">
      {winner !== undefined ? (
        <OrangeWinnerBar name={winner.name} seat={seatForIndex(0)} score={winner.score} label="Winner" />
      ) : null}
      <LeaderboardRows entries={entries} />
    </div>
  );
}
