import { useState } from 'react';

import { Card, Pill, Segmented } from '@gbedity/ui';

import { MOCK_ROOM_CODE } from '../../../shared/constants/routes.ts';
import { getGameContent } from '../../../shared/games/game-content.tsx';
import { gameById } from '../../../shared/games/games-manifest.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useGameParam } from '../use-game-param.ts';

// §5.3 — player in-game. Three states the spec calls out: active (input), waiting,
// spectator. A local toggle lets you preview each in this UI-only build.
const PlayerState = { ACTIVE: 'Active', WAITING: 'Waiting', SPECTATOR: 'Spectating' } as const;
type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

export function PlayerGameScreen() {
  const id = useGameParam();
  const game = gameById(id);
  const content = game ? getGameContent(game.key) : undefined;
  const [state, setState] = useState<PlayerState>(PlayerState.ACTIVE);
  if (game === undefined || content === undefined) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        roomCode={MOCK_ROOM_CODE}
        right={<Pill tone="action">You: 320 pts</Pill>}
      />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-2">
        {/* State preview toggle — UI-only affordance to see each player state. */}
        <Segmented
          value={state}
          onChange={setState}
          ariaLabel="Preview player state"
          options={[PlayerState.ACTIVE, PlayerState.WAITING, PlayerState.SPECTATOR].map((s) => ({ value: s, label: s }))}
        />

        {state === PlayerState.ACTIVE ? (
          <Card size="lg">{content.renderPlayer()}</Card>
        ) : state === PlayerState.WAITING ? (
          <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-serif text-[20px] font-semibold text-ink">Wait for your turn</p>
            <div className="flex gap-1" aria-label="Waiting">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </Card>
        ) : (
          <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
            <Pill tone="info">Spectating this round</Pill>
            <p className="font-sans text-[14px] text-ink-3">You&apos;re over the cap for this game. Watch the shared screen — you&apos;re back next round.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
