import { GameId } from '@gbedity/ui';

import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameById } from '../../../shared/games/games-manifest.ts';
import { useGameParam } from '../use-game-param.ts';

// §5.1 — display in-game. Slim top/bottom bars; the per-game content fills the centre card.
export function DisplayGameScreen() {
  const id = useGameParam();
  const game = gameById(id);
  const content = game ? getGameContent(game.key) : undefined;
  if (game === undefined || content === undefined) return <GameMissing />;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-10 py-5">
        <div className="flex items-center gap-3">
          <GameId id={game.id} category={game.category} size="sm" />
          <span className="font-serif text-[20px] font-semibold text-ink">{game.title}</span>
        </div>
        <span className="font-sans text-[15px] font-bold text-ink-3">Round 2 · 3 left</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-10 pb-6">
        <div className="w-full max-w-2xl rounded-card-lg bg-surface p-10">{content.renderDisplay()}</div>
      </main>
      <footer className="px-10 py-4 text-center font-sans text-[13px] text-ink-3">
        Host controls on phone
      </footer>
    </div>
  );
}

function GameMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="font-sans text-[15px] text-ink-3">No active game.</p>
    </div>
  );
}
