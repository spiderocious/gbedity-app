import { Card, DrawerService, Pill, RoomCodeChip } from '@gbedity/ui';
import { ArrowRight, Settings2, Trophy, Zap, type LucideIcon } from '@icons';
import { useNavigate } from 'react-router-dom';

import { useCreateRoom } from '../../../shared/api/use-create-room.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { ApiError } from '../../../shared/services/api-error.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// "Made for nights like these" — compressed to inline chips beneath the decision card.
const NIGHT_CHIPS = ['Family', 'Friends', 'Cousins'] as const;

// §1.5 — host start. Three modes. Choosing one CREATES a real room (POST /rooms) then routes
// to the catalogue (Quick/Create) or league builder, carrying the real room code.
const Mode = { QUICK: 'quick', CREATE: 'create', LEAGUE: 'league' } as const;
type Mode = (typeof Mode)[keyof typeof Mode];

interface ModeTile {
  readonly mode: Mode;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly badge?: string;
}

const MODES: readonly ModeTile[] = [
  { mode: Mode.QUICK, title: 'Quick Play', description: 'Pick a game, defaults, start in seconds.', icon: Zap },
  { mode: Mode.CREATE, title: 'Create Game', description: 'Pick a game and tune every setting.', icon: Settings2 },
  { mode: Mode.LEAGUE, title: 'League Play', description: 'Queue several games into one session with a combined leaderboard.', icon: Trophy, badge: 'League' },
];

export function HostStartScreen() {
  const navigate = useNavigate();
  const createRoom = useCreateRoom();

  function choose(mode: Mode) {
    if (createRoom.isPending) return;
    const nickname = sessionStore.getNickname() ?? 'Host';
    createRoom.mutate(nickname, {
      onSuccess: (room) => {
        // All modes land on the host lobby (room dashboard) — the single working hub: it shows
        // the code + QR to share, holds the game queue, and starts single games OR a league
        // (queue ≥2 → "Start league", which calls POST /rooms/:code/league). League just means
        // queuing 2+ games here; there's no separate builder dead-end. `league=1` nudges the
        // lobby copy toward the league framing.
        const leagueHint = mode === Mode.LEAGUE ? '&league=1' : '';
        navigate(`${pathWith(ROUTES.HOST_LOBBY, { code: room.code })}?picked=${mode}${leagueHint}`);
      },
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : 'Could not open a room.';
        DrawerService.toast(msg, { tone: 'danger' });
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader backTo={ROUTES.LANDING} />
      {/* Centre the decision card in the remaining viewport (header floor via flex-1). */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-8">
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Host a room
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            Pick how you want to play.
          </h1>
          <p className="mt-1 font-sans text-[14px] leading-[1.5] text-ink-3">
            Open the room on a screen the room can see. Players join from their phones.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.mode}
                  type="button"
                  disabled={createRoom.isPending}
                  onClick={() => choose(mode.mode)}
                  className="group flex w-full items-center gap-4 rounded-card bg-canvas px-4 py-4 text-left transition-[transform,background-color] duration-150 ease-in-out hover:-translate-y-px hover:bg-canvas-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                >
                  <span aria-hidden="true" className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface text-action">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Title + badge: stacked (badge on its own line, left-aligned) on mobile,
                        inline from sm up. Keeps "League Play" from wrapping on small screens. */}
                    <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-sans text-[16px] font-bold text-ink">{mode.title}</span>
                      {mode.badge !== undefined ? <Pill tone="special">{mode.badge}</Pill> : null}
                    </span>
                    <span className="mt-[2px] block font-sans text-[13px] leading-[1.45] text-ink-3">{mode.description}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="flex-shrink-0 text-ink-4 group-hover:text-ink-3" />
                </button>
              );
            })}
          </div>

          {createRoom.isPending ? (
            <p className="mt-4 text-center font-sans text-[13px] text-ink-3">Opening a room…</p>
          ) : null}
        </Card>

        {/* Compressed "Made for nights like these" — inline chips reinforcing context. */}
        <div className="flex items-center justify-center gap-2" aria-label="Made for nights like these">
          {NIGHT_CHIPS.map((chip) => (
            <Pill key={chip} tone="default">
              {chip}
            </Pill>
          ))}
        </div>
      </main>
    </div>
  );
}
