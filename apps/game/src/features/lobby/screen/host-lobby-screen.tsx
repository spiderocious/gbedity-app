import { Button, Card, DrawerService, PlayerPill, RoomCodeChip } from '@gbedity/ui';
import { EllipsisVertical, Settings } from '@icons';
import { Link, useNavigate } from 'react-router-dom';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { HOST_ID, PLAYERS } from '../../../shared/mock/players.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §2.3 — host lobby. Room status, player roster with per-player menu, next-game CTA.
export function HostLobbyScreen() {
  const navigate = useNavigate();
  const { go, curtain } = useStageNav();

  function playerMenu(name: string) {
    DrawerService.confirm(`Manage ${name}`, {
      description: 'Hand off host, or remove them from the room.',
      confirmLabel: 'Boot player',
      cancelLabel: 'Close',
      destructive: true,
      onConfirm: () => DrawerService.toast(`${name} was removed.`, { tone: 'default' }),
    });
  }

  function endSession() {
    DrawerService.critical('End the session?', {
      description: 'This ends the room for everyone.',
      confirmPhrase: 'END',
      confirmPrompt: <>Type <strong>END</strong> to confirm</>,
      confirmLabel: 'End session',
      onConfirm: () => navigate(ROUTES.LANDING),
    });
  }

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <AppHeader
        roomCode={MOCK_ROOM_CODE}
        right={
          <button type="button" aria-label="Room settings" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink hover:bg-canvas-deep">
            <Settings size={18} aria-hidden="true" />
          </button>
        }
      />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 pt-4">
        <Card size="lg" className="flex flex-col items-start gap-1">
          <RoomCodeChip code={MOCK_ROOM_CODE} size="lg" />
          <span className="font-sans text-[14px] text-ink-3">{PLAYERS.length} players joined</span>
        </Card>

        <Card size="lg" className="flex flex-col gap-2">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Players</h2>
          {PLAYERS.map((p) => {
            const isHost = p.id === HOST_ID;
            return (
              <PlayerPill
                key={p.id}
                name={p.name}
                seat={p.seat}
                size="sm"
                tag={isHost ? '(you · host)' : undefined}
                trailing={
                  isHost ? undefined : (
                    <button type="button" aria-label={`Manage ${p.name}`} onClick={() => playerMenu(p.name)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                      <EllipsisVertical size={18} aria-hidden="true" />
                    </button>
                  )
                }
              />
            );
          })}
        </Card>

        <Card size="lg" className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Next game</h2>
          <p className="font-sans text-[14px] text-ink-3">No game picked yet. Choose one to get started.</p>
          <Button variant="primary" size="lg" className="w-full" onClick={() => go(`${ROUTES.HOST_CATALOGUE}?mode=quick`)}>
            Pick a game
          </Button>
          <Link to={mockPath(ROUTES.DISPLAY_LOBBY)} className="text-center font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-action hover:text-action-deep">
            Open the shared screen →
          </Link>
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink-5 bg-surface px-6 py-4">
        <div className="mx-auto max-w-md">
          <Button variant="ghost" className="w-full" onClick={endSession}>End session</Button>
        </div>
      </div>
      {curtain}
    </div>
  );
}
