import { Button, GameId, LeaderboardRows, OrangeWinnerBar } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { type GameKey } from '../../../shared/games/games-manifest.ts';
import { LEADERBOARD } from '../../../shared/mock/players.ts';
import { useGameParam } from '../../in-game/use-game-param.ts';

// §6.1 — display post-game inside the Stage Cobalt poster frame. Celebration card (per-game)
// → orange winner bar → ranked leaderboard.
export function DisplayResultScreen() {
  const id = useGameParam();
  const { game } = useCatalogueGame(id);
  const content = game ? getGameContent(game.key as GameKey) : undefined;
  const navigate = useNavigate();
  if (game === undefined || content === undefined) return null;

  const winner = LEADERBOARD[0];

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-3xl rounded-stage bg-stage p-3">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-serif text-[22px] font-semibold text-white">Final scores</span>
          <span className="flex items-center gap-2 font-sans text-[13px] font-bold text-white/80">
            <GameId id={game.id} category={game.category} size="sm" className="opacity-100 [color:white]" />
            {game.title}
          </span>
        </div>
        <div className="flex flex-col gap-4 rounded-card-lg bg-surface p-8">
          <div className="rounded-card bg-canvas px-5 py-5">{content.renderCelebration()}</div>
          {winner !== undefined ? (
            <OrangeWinnerBar name={winner.name} seat={winner.seat} score={winner.score} label="Winner" />
          ) : null}
          <LeaderboardRows entries={LEADERBOARD.map((e) => ({ name: e.name, seat: e.seat, score: e.score }))} />
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => navigate(`${mockPath(ROUTES.DISPLAY_GAME)}?mock=${id}`)}>Play again</Button>
            <Button variant="secondary" onClick={() => navigate(mockPath(ROUTES.DISPLAY_LOBBY))}>Pick another</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>End session</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
