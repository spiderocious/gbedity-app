import { useEffect, useState } from 'react';

import { Button, Logo, PlayerPill, QrCode, RoomCodeChip } from '@gbedity/ui';
import { Link } from 'react-router-dom';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { PLAYERS } from '../../../shared/mock/players.ts';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §2.1 — display lobby (landscape, large text). QR + room code centre, player list rail.
// Players join in sequence over the first 16s (mock), then hold at 4. When this device is
// both display + host controller, a compact host-control strip appears at the bottom.
export function DisplayLobbyScreen() {
  const [count, setCount] = useState(1);
  const { go, curtain } = useStageNav();

  useEffect(() => {
    if (count >= PLAYERS.length) return undefined;
    const timer = window.setTimeout(() => setCount((c) => Math.min(c + 1, PLAYERS.length)), 4000);
    return () => window.clearTimeout(timer);
  }, [count]);

  const joined = PLAYERS.slice(0, count);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-10 py-6">
        <Logo size="lg" />
        <RoomCodeChip code={MOCK_ROOM_CODE} size="lg" />
        <span className="font-sans text-[14px] font-bold text-ink-3">How players join</span>
      </header>

      <div className="flex flex-1 gap-10 px-10 pb-6">
        <main className="flex flex-1 flex-col items-center justify-center gap-6">
          <QrCode url={`https://gbedity.app/join/${MOCK_ROOM_CODE}`} size={240} className="border-2 border-action" />
          <RoomCodeChip code={MOCK_ROOM_CODE} size="hero" />
          <p className="max-w-[44ch] text-center font-sans text-[20px] leading-[1.5] text-ink-3">
            Open gbedity.app on your phone and enter the code — or scan.
          </p>
        </main>

        <aside className="flex w-[340px] flex-col gap-3">
          <h2 className="font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Players
          </h2>
          {joined.map((p) => (
            <PlayerPill key={p.id} name={p.name} seat={p.seat} meta={p.joinedAgo} size="lg" />
          ))}
        </aside>
      </div>

      {/* Host-control strip — shown when this device is both display + host controller
          (§2.1). Also the way forward when testing from the display lobby directly. */}
      <footer className="flex items-center justify-between gap-4 bg-surface px-10 py-5">
        <span className="font-serif text-[24px] font-semibold text-ink">
          Waiting for players · {count} joined
        </span>
        <div className="flex items-center gap-3">
          <Link
            to={mockPath(ROUTES.HOST_LOBBY)}
            className="font-sans text-[14px] font-bold text-ink-3 hover:text-ink"
          >
            Configure
          </Link>
          <Button variant="primary" onClick={() => go(`${mockPath(ROUTES.DISPLAY_GAME)}?game=6`)}>
            Start game
          </Button>
        </div>
      </footer>
      {curtain}
    </div>
  );
}
