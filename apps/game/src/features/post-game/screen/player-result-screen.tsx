import { Button, Card, Score } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// §7.1 — player result. Current user is Funmi, 3rd with 940 (spec mock).
export function PlayerResultScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={MOCK_ROOM_CODE} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-8">
        <Card size="lg" className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">You came 3rd</h1>
          <Score value={940} size="lg" tone="ink" unit="pts" />
        </Card>

        <Card size="lg" className="flex flex-col gap-2">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Your round</h2>
          <div className="flex items-center justify-between"><span className="font-sans text-[14px] text-ink-2">Correct answers</span><span className="font-sans text-[14px] font-bold text-ink">6 / 10</span></div>
          <div className="flex items-center justify-between"><span className="font-sans text-[14px] text-ink-2">Best single round</span><span className="font-sans text-[14px] font-bold text-ink">+220</span></div>
          <div className="flex items-center justify-between"><span className="font-sans text-[14px] text-ink-2">Avg answer time</span><span className="font-sans text-[14px] font-bold text-ink">4.3s</span></div>
        </Card>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={() => navigate(mockPath(ROUTES.PLAYER_LOBBY))}>Stay for next game</Button>
          <Button variant="ghost" onClick={() => navigate(ROUTES.LANDING)}>Leave session</Button>
        </div>
      </main>
    </div>
  );
}
