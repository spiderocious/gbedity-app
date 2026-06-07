import { Button, Card, DrawerService, LeaderboardRows, OrangeWinnerBar } from '@gbedity/ui';
import { useNavigate, useParams } from 'react-router-dom';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { MOCK_ROOM_CODE, ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameKey } from '../../../shared/games/games-manifest.ts';
import { LEADERBOARD } from '../../../shared/mock/players.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useGameParam } from '../../in-game/use-game-param.ts';

// §6.2 — host post-game (preview/mock). Uses the live :code from the route so it never shows
// the mock code on a real room.
export function HostResultScreen() {
  const id = useGameParam();
  const { game } = useCatalogueGame(id);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const navigate = useNavigate();
  const { code = MOCK_ROOM_CODE } = useParams();
  if (game === undefined || content === undefined) return null;

  const winner = LEADERBOARD[0];

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <AppHeader roomCode={code} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        {winner !== undefined ? (
          <OrangeWinnerBar name={winner.name} seat={winner.seat} score={winner.score} label="Winner" />
        ) : null}

        <Card size="lg" className="flex flex-col gap-2">
          {content.postGameStats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">{s.label}</span>
              <span className="font-sans text-[14px] font-bold text-ink">{s.value}</span>
            </div>
          ))}
        </Card>

        <Card size="lg">
          <LeaderboardRows entries={LEADERBOARD.map((e) => ({ name: e.name, seat: e.seat, score: e.score }))} />
        </Card>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={() => navigate(`${pathWith(ROUTES.HOST_GAME, { code })}?mock=${id}`)}>Play again</Button>
          <Button variant="secondary" onClick={() => navigate(pathWith(ROUTES.HOST_LOBBY, { code }))}>Pick another</Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => DrawerService.openModal(<ShareSheet />, { position: 'bottom' })}>Share result</Button>
            <Button variant="ghost" className="flex-1" onClick={() => navigate(pathWith(ROUTES.HOST_ROUND_DETAIL, { code, n: '1' }))}>Round detail</Button>
          </div>
          <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>End session</Button>
        </div>
      </main>
    </div>
  );
}

function ShareSheet() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Share this result</h2>
      <p className="font-sans text-[14px] text-ink-3">Ada won with 1,420 — send the room a recap.</p>
      <Button variant="primary" onClick={() => DrawerService.closeModal()}>Copy recap</Button>
    </div>
  );
}
