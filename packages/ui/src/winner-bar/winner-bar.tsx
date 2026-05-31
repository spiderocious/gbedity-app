import type { ReactNode } from 'react';

import { Avatar, type SeatIndex } from '../avatar/avatar.tsx';
import { cn } from '../utils/cn.ts';

export interface OrangeWinnerBarProps {
  name: string;
  initial?: string;
  seat?: SeatIndex;
  score: number | string;
  /** Small label before the name — e.g. "Winner", "Top scorer", "Banker". Default "Winner". */
  label?: string;
  /** Optional unit after the score (e.g. "pts"). */
  unit?: ReactNode;
  className?: string;
}

// Visual spec: screens-spec §6 (post-game)
//
// The single solid Accent Orange winner row. The brand reserves orange for celebration —
// this is its canonical use. White content on accent; score in Fraunces.
export function OrangeWinnerBar({
  name,
  initial,
  seat = 1,
  score,
  label = 'Winner',
  unit,
  className,
}: Readonly<OrangeWinnerBarProps>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-card bg-accent px-5 py-4 text-white',
        className,
      )}
    >
      <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85">
        {label}
      </span>
      <Avatar initial={initial ?? name.slice(0, 1)} seat={seat} size="md" />
      <span className="min-w-0 flex-1 truncate font-serif text-[20px] font-semibold">{name}</span>
      <span className="inline-flex items-baseline font-serif text-[32px] font-semibold leading-none tabular-nums">
        {score}
        {unit !== undefined && unit !== null ? (
          <span className="ml-[3px] font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-white/80">
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}
