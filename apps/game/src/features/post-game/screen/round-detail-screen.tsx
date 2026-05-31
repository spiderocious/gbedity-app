import { Avatar, Button, Card, Score } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { PLAYERS } from '../../../shared/mock/players.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// §6.3 — round detail. Per-player breakdown of the round's answers + per-answer scores.
const ROUND_ANSWERS: Record<string, readonly { readonly answer: string; readonly pts: number }[]> = {
  tobi: [{ answer: 'amala', pts: 180 }, { answer: 'akara', pts: 120 }],
  ada: [{ answer: 'efo', pts: 220 }, { answer: 'eba', pts: 160 }],
  funmi: [{ answer: 'rice', pts: 90 }, { answer: '—', pts: 0 }],
  kemi: [{ answer: 'yam', pts: 110 }],
};

export function RoundDetailScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <AppHeader roomCode={MOCK_ROOM_CODE} />
      <main className="mx-auto flex max-w-md flex-col gap-3 px-6 pt-2">
        <h1 className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink">Round 2 detail</h1>
        {PLAYERS.map((p) => {
          const answers = ROUND_ANSWERS[p.id] ?? [];
          return (
            <Card key={p.id} size="lg" className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar initial={p.name.slice(0, 1)} seat={p.seat} />
                <span className="font-serif text-[18px] font-semibold text-ink">{p.name}</span>
              </div>
              {answers.map((a, i) => (
                <div key={i} className="flex items-center justify-between border-t border-dashed border-ink-5 pt-2 first:border-t-0 first:pt-0">
                  <span className="font-sans text-[14px] text-ink-2">{a.answer}</span>
                  <Score value={`+${a.pts}`} size="sm" tone={a.pts > 0 ? 'action' : 'ink'} />
                </div>
              ))}
            </Card>
          );
        })}
        <Button variant="ghost" onClick={() => navigate(mockPath(ROUTES.HOST_RESULT))}>Back to scores</Button>
      </main>
    </div>
  );
}
