import { Avatar, Button, LeaderboardRows, Score } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { LEADERBOARD } from '../../../shared/mock/players.ts';

// §6.4 — league final inside the Stage Cobalt poster frame. Podium top-3 + full ranking.
const PODIUM = [
  { ...LEADERBOARD[1], place: 2, h: 'h-28', breakdown: '40% Word Bomb · 35% Catch the Lie' },
  { ...LEADERBOARD[0], place: 1, h: 'h-40', breakdown: '52% Word Bomb · 44% Plead Your Case' },
  { ...LEADERBOARD[2], place: 3, h: 'h-20', breakdown: '30% Catch the Lie · 28% Word Bomb' },
];

export function LeagueResultScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-3xl rounded-stage bg-stage p-3">
        <div className="px-4 py-3">
          <span className="font-serif text-[24px] font-semibold text-white">League Final</span>
        </div>
        <div className="flex flex-col gap-6 rounded-card-lg bg-surface p-8">
          <div className="flex items-end justify-center gap-4">
            {PODIUM.map((p) =>
              p === undefined || p.name === undefined ? null : (
                <div key={p.place} className="flex w-[120px] flex-col items-center gap-2">
                  <Avatar initial={p.name.slice(0, 1)} seat={p.seat ?? 1} size="lg" />
                  <span className="font-serif text-[16px] font-semibold text-ink">{p.name}</span>
                  <Score value={p.score ?? 0} size="sm" tone={p.place === 1 ? 'accent' : 'ink'} />
                  <div className={`flex w-full items-start justify-center rounded-t-card ${p.place === 1 ? 'bg-accent' : 'bg-canvas-deep'} ${p.h} pt-2`}>
                    <span className={`font-serif text-[28px] font-semibold ${p.place === 1 ? 'text-white' : 'text-ink-3'}`}>{p.place}</span>
                  </div>
                  <span className="text-center font-sans text-[10px] leading-[1.3] text-ink-3">{p.breakdown}</span>
                </div>
              ),
            )}
          </div>

          <LeaderboardRows entries={LEADERBOARD.map((e) => ({ name: e.name, seat: e.seat, score: e.score }))} />

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => navigate(ROUTES.HOST_LEAGUE_NEW)}>Start another league</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>End session</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
