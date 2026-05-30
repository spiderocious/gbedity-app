import type { ReactNode } from 'react';

import { Avatar, type SeatIndex } from '../avatar/avatar.tsx';
import { Score } from '../score/score.tsx';
import { cn } from '../utils/cn.ts';

export interface LobbyRowProps {
  initial: string;
  seat?: SeatIndex;
  name: string;
  meta?: string;
  trailing?: ReactNode;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/14-cards-tiles-rows.html
//
// LobbyRow — warm canvas. Used when there are no scores yet (initial lobby).
// Avatar · name · join time · state pill (or any trailing slot).
export function LobbyRow({ initial, seat = 1, name, meta, trailing, className }: LobbyRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-[14px] bg-canvas px-[14px] py-3',
        className,
      )}
    >
      <Avatar initial={initial} seat={seat} />
      <div className="min-w-0">
        <div className="truncate font-sans text-[14px] font-bold text-ink">{name}</div>
        {meta !== undefined && meta !== '' ? (
          <div className="truncate text-[11px] text-ink-3">{meta}</div>
        ) : null}
      </div>
      {trailing !== undefined && trailing !== null ? <div>{trailing}</div> : null}
    </div>
  );
}

export interface RankedRowProps {
  rank: number;
  initial: string;
  seat?: SeatIndex;
  name: string;
  score: number | string;
  /** When true, rank tints accent-deep and score takes the win tint. Set on rank-1 typically. */
  isTop?: boolean;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/14-cards-tiles-rows.html
//
// RankedRow — for post-game leaderboards. Rank · avatar · name · Fraunces
// tabular score. Hairline separator between rows. Top rank tints accent.
export function RankedRow({
  rank,
  initial,
  seat = 1,
  name,
  score,
  isTop,
  className,
}: RankedRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[22px_36px_1fr_auto] items-center gap-[10px] border-t border-dashed border-ink-5 px-1 py-[10px] first:border-t-0',
        className,
      )}
    >
      <span
        className={cn(
          'text-right font-serif text-[16px] font-semibold leading-none tabular-nums',
          isTop === true ? 'text-accent-deep' : 'text-ink-3',
        )}
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48' }}
      >
        {rank}
      </span>
      <Avatar initial={initial} seat={seat} />
      <span className="truncate font-sans text-[14px] font-bold text-ink">{name}</span>
      <Score value={score} size="md" tone={isTop === true ? 'accent' : 'ink'} />
    </div>
  );
}
