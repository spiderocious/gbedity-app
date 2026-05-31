import type { ReactNode } from 'react';

import { RankedRow } from '../player-row/player-row.tsx';
import type { SeatIndex } from '../avatar/avatar.tsx';
import { cn } from '../utils/cn.ts';

export interface LeaderboardEntry {
  readonly name: string;
  readonly score: number | string;
  readonly initial?: string;
  readonly seat?: SeatIndex;
  /** Optional per-row detail line shown beneath (e.g. AI rationale snippet). */
  readonly detail?: ReactNode;
}

export interface LeaderboardRowsProps {
  /** Already in finishing order; rank is derived from index. */
  entries: readonly LeaderboardEntry[];
  /** Rank 1 takes the accent/top treatment. Default true. */
  highlightTop?: boolean;
  className?: string;
}

// Visual spec: screens-spec §6 (ranked leaderboard rows)
//
// Hairline-divided ranked rows for post-game + between-games. Composes RankedRow; rank is
// the 1-based index. Top rank tints accent unless disabled.
export function LeaderboardRows({
  entries,
  highlightTop = true,
  className,
}: Readonly<LeaderboardRowsProps>) {
  return (
    <div className={cn('flex flex-col', className)}>
      {entries.map((entry, index) => (
        <div key={`${entry.name}-${index}`}>
          <RankedRow
            rank={index + 1}
            initial={entry.initial ?? entry.name.slice(0, 1)}
            seat={entry.seat ?? (((index % 8) + 1) as SeatIndex)}
            name={entry.name}
            score={entry.score}
            isTop={highlightTop && index === 0}
          />
          {entry.detail !== undefined && entry.detail !== null ? (
            <p className="px-1 pb-2 pl-[68px] font-sans text-[12px] leading-[1.5] text-ink-3">
              {entry.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
