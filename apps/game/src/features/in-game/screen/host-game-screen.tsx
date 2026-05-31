import { Button, Card, DrawerService, GameId } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameById } from '../../../shared/games/games-manifest.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useGameParam } from '../use-game-param.ts';

// §5.2 — host in-game. Compact status + host controls. End-game confirms; pause is instant.
export function HostGameScreen() {
  const id = useGameParam();
  const game = gameById(id);
  const content = game ? getGameContent(game.key) : undefined;
  const navigate = useNavigate();
  if (game === undefined || content === undefined) return null;

  function endGame() {
    DrawerService.confirm('End the game now?', {
      description: 'Current scores will count.',
      confirmLabel: 'End game',
      cancelLabel: 'Keep playing',
      destructive: true,
      onConfirm: () => navigate(`${mockPath(ROUTES.HOST_RESULT)}?game=${id}`),
    });
  }

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <AppHeader
        roomCode={MOCK_ROOM_CODE}
        right={<span className="font-sans text-[13px] font-bold text-ink-3">Round 2 · 3 left</span>}
      />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        <Card size="lg" className="flex items-center gap-3">
          <GameId id={game.id} category={game.category} size="sm" />
          <span className="font-serif text-[20px] font-semibold text-ink">{game.title}</span>
        </Card>

        <Card size="lg">{content.renderDisplay()}</Card>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Host controls</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => DrawerService.toast('Paused', { tone: 'default' })}>Pause</Button>
            <Button variant="secondary" onClick={() => DrawerService.confirm('Skip this turn?', { confirmLabel: 'Skip', onConfirm: () => undefined })}>Skip turn</Button>
            <Button variant="secondary" onClick={() => DrawerService.confirm('End the round early?', { confirmLabel: 'End round', destructive: true, onConfirm: () => undefined })}>End round</Button>
            <Button variant="danger" onClick={endGame}>End game</Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
