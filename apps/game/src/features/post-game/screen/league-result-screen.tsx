import { Avatar, Button, LeaderboardRows, Score } from '@gbedity/ui';
import { useNavigate, useParams } from 'react-router-dom';

import { useLobby } from '../../../shared/api/use-lobby.ts';
import { useLeagueStandings } from '../../../shared/api/use-start-league.ts';
import { ROUTES } from '../../../shared/constants/routes.ts';
import { LEADERBOARD, type MockScore } from '../../../shared/mock/players.ts';
import { seatForIndex } from '../../lobby/seat.ts';

// §6.4 — league final inside the Stage Cobalt poster frame. Podium top-3 + full ranking.
// Uses live standings (GET /rooms/:code/league/standings) resolved against the lobby roster
// for names; falls back to the mock board when no league is running.
export function LeagueResultScreen() {
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const standings = useLeagueStandings(code);
  const lobby = useLobby(code);

  const nameOf = (playerId: string) =>
    lobby.data?.players.find((p) => p.id === playerId)?.nickname ?? 'Player';

  const board: readonly MockScore[] =
    standings.data !== undefined && standings.data.standings.length > 0
      ? standings.data.standings.map((s, i) => ({ name: nameOf(s.playerId), seat: seatForIndex(i), score: s.score }))
      : LEADERBOARD;

  const podium = [
    { entry: board[1], place: 2, h: 'h-28' },
    { entry: board[0], place: 1, h: 'h-40' },
    { entry: board[2], place: 3, h: 'h-20' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-3xl rounded-stage bg-stage p-3">
        <div className="px-4 py-3">
          <span className="font-serif text-[24px] font-semibold text-white">League Final</span>
        </div>
        <div className="flex flex-col gap-6 rounded-card-lg bg-surface p-8">
          <div className="flex items-end justify-center gap-4">
            {podium.map((p) =>
              p.entry === undefined ? null : (
                <div key={p.place} className="flex w-[120px] flex-col items-center gap-2">
                  <Avatar initial={p.entry.name.slice(0, 1)} seat={p.entry.seat} size="lg" />
                  <span className="font-serif text-[16px] font-semibold text-ink">{p.entry.name}</span>
                  <Score value={p.entry.score} size="sm" tone={p.place === 1 ? 'accent' : 'ink'} />
                  <div className={`flex w-full items-start justify-center rounded-t-card ${p.place === 1 ? 'bg-accent' : 'bg-canvas-deep'} ${p.h} pt-2`}>
                    <span className={`font-serif text-[28px] font-semibold ${p.place === 1 ? 'text-white' : 'text-ink-3'}`}>{p.place}</span>
                  </div>
                </div>
              ),
            )}
          </div>

          <LeaderboardRows entries={board.map((e) => ({ name: e.name, seat: e.seat, score: e.score }))} />

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => navigate(ROUTES.HOST_LEAGUE_NEW)}>Start another league</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>End session</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
