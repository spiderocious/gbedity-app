import { GameAvatar } from '@gbedity/ui';
import { Check } from '@icons';
import { Repeat } from 'meemaw';

// "We're all racing" presence row for the playing stage. The backend playing-phase patch does NOT
// expose per-player submission state for OTHERS, so we do NOT fabricate it — we show the real roster
// in the round, with the local player's own LOCKED state surfaced honestly ("You ✓" once they submit,
// right or wrong). This delivers the social-presence feel without inventing data.

export interface RoundPlayer {
  readonly id: string;
  readonly name: string;
}

interface RoundPresenceProps {
  readonly players: readonly RoundPlayer[];
  /** The local player's id (gets the "You" treatment + locked check). */
  readonly youId?: string;
  /** Whether the local player has submitted (locked in) this round — right or wrong. */
  readonly youLocked: boolean;
}

export function RoundPresence({ players, youId, youLocked }: Readonly<RoundPresenceProps>) {
  if (players.length === 0) return null;
  const shown = players.slice(0, 6);
  const extra = players.length - shown.length;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Players in this round">
      <Repeat each={[...shown]}>
        {(p) => {
          const isYou = youId !== undefined && p.id === youId;
          const locked = isYou && youLocked;
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 ${
                locked ? 'bg-action-soft' : 'bg-canvas'
              }`}
            >
              <GameAvatar id={p.id} initial={p.name.charAt(0).toUpperCase()} size="sm" />
              <span className={`font-sans text-[12px] font-bold ${locked ? 'text-action-deep' : 'text-ink-2'}`}>
                {isYou ? 'You' : p.name}
              </span>
              {locked ? <Check size={13} className="text-action-deep" aria-label="locked in" /> : null}
            </span>
          );
        }}
      </Repeat>
      {extra > 0 ? <span className="font-sans text-[12px] font-bold text-ink-4">+{extra}</span> : null}
    </div>
  );
}
