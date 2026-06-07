import type { ReactNode } from 'react';

import { Avatar, type AvatarSize, type SeatIndex } from '../avatar/avatar.tsx';
import { GameAvatar } from '../avatar/game-avatar.tsx';
import { cn } from '../utils/cn.ts';

export type PlayerPillSize = 'sm' | 'md' | 'lg';

export interface PlayerPillProps {
  /** Player nickname. */
  name: string;
  /**
   * Stable player id. When set, renders the distinctive DiceBear GameAvatar seeded from it
   * (each player gets a unique character); otherwise falls back to the seat-coloured initial.
   */
  avatarId?: string;
  /** Avatar initial — defaults to first letter of name. */
  initial?: string;
  /** Seat colour 1–8. */
  seat?: SeatIndex;
  /** Meta line under the name (e.g. "joined 4s ago"). */
  meta?: string;
  /** Highlight as the current user — thin Action Green ring + "(you)" treatment. */
  isYou?: boolean;
  /** Tag rendered after the name (e.g. "(you · host)"). */
  tag?: string;
  /** Trailing slot — e.g. a 3-dot menu, a state Pill, or a rank+score. */
  trailing?: ReactNode;
  size?: PlayerPillSize;
  className?: string;
}

// Visual spec: screens-spec §2 (warm-chunky lobby rows)
//
// The chunky lobby pill: avatar + nickname (+ meta) on a canvas surface. Used on the
// display lobby player list and the player/host lobbies. For ranked/score rows in the
// between-games lobby use LeaderboardRows instead.
interface SizeSpec {
  readonly pad: string;
  readonly gap: string;
  readonly name: string;
  readonly avatar: AvatarSize;
}

const SIZE: Record<PlayerPillSize, SizeSpec> = {
  sm: { pad: 'px-3 py-2', gap: 'gap-2', name: 'text-[14px]', avatar: 'sm' },
  md: { pad: 'px-[14px] py-3', gap: 'gap-3', name: 'text-[16px]', avatar: 'md' },
  lg: { pad: 'px-5 py-4', gap: 'gap-3', name: 'text-[20px]', avatar: 'lg' },
};

export function PlayerPill({
  name,
  avatarId,
  initial,
  seat = 1,
  meta,
  isYou = false,
  tag,
  trailing,
  size = 'md',
  className,
}: Readonly<PlayerPillProps>) {
  const s = SIZE[size];
  const fallbackInitial = initial ?? name.slice(0, 1);
  return (
    <div
      className={cn(
        'flex items-center rounded-full bg-canvas',
        s.pad,
        s.gap,
        isYou ? 'ring-2 ring-action' : '',
        className,
      )}
    >
      {avatarId !== undefined ? (
        <GameAvatar id={avatarId} initial={fallbackInitial} seat={seat} size={s.avatar} />
      ) : (
        <Avatar initial={fallbackInitial} seat={seat} size={s.avatar} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[6px]">
          <span className={cn('truncate font-serif font-semibold text-ink', s.name)}>{name}</span>
          {tag !== undefined ? (
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
              {tag}
            </span>
          ) : null}
          {isYou && tag === undefined ? (
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-action-deep">
              (you)
            </span>
          ) : null}
        </div>
        {meta !== undefined && meta !== '' ? (
          <div className="truncate font-sans text-[11px] text-ink-3">{meta}</div>
        ) : null}
      </div>
      {trailing !== undefined && trailing !== null ? (
        <div className="flex-shrink-0">{trailing}</div>
      ) : null}
    </div>
  );
}
