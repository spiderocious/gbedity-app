import { cn } from '@gbedity/ui';

// The money ladder — shown as a vertical list of rungs, current rung highlighted in accent orange.
// Rendered on the question screen so the player always knows what's at stake. Props-only, no logic.

const LADDER = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;

export const formatRung = (value: number): string =>
  value >= 1_000 ? `₦${(value / 1_000).toLocaleString()}k` : `₦${value}`;

interface MoneyLadderProps {
  readonly currentIdx: number;
  readonly eliminatedIdx?: number; // rung where the player was eliminated (-1 = not yet)
  readonly className?: string;
}

export function MoneyLadder({ currentIdx, eliminatedIdx = -1, className }: MoneyLadderProps) {
  return (
    <div className={cn('flex flex-col-reverse gap-0.5', className)}>
      {LADDER.map((value, idx) => {
        const isCurrent = idx === currentIdx;
        const isEliminated = eliminatedIdx !== -1 && idx === eliminatedIdx;
        const isPast = idx < currentIdx && eliminatedIdx === -1;

        return (
          <div
            key={value}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-1.5 font-sans text-[13px] font-bold transition-colors',
              isCurrent && 'bg-accent text-surface shadow-[0_2px_8px_rgba(255,138,42,0.4)]',
              isEliminated && 'bg-danger-soft text-danger line-through opacity-60',
              isPast && 'bg-surface/10 text-surface/50',
              !isCurrent && !isEliminated && !isPast && 'bg-surface/5 text-surface/40',
            )}
          >
            <span className="tabular-nums">{idx + 1}</span>
            <span className="tabular-nums">{formatRung(value)}</span>
          </div>
        );
      })}
    </div>
  );
}
