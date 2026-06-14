import { cn } from '@gbedity/ui';

// A horizontal timer bar driven by an explicit 0..1 `progress` (1 = full time left, 0 = expired).
// Colour shifts ink → warn → danger as time runs out (branding: timer state colours). Pure
// presentation — the caller owns the clock. `secondsLeft` renders the number; omit to hide it.

interface RoundClockProps {
  /** Fraction of time remaining, 1 → 0. */
  readonly progress: number;
  readonly secondsLeft?: number;
  readonly tone?: 'on-light' | 'on-dark';
  readonly className?: string;
}

export function RoundClock({ progress, secondsLeft, tone = 'on-light', className }: RoundClockProps) {
  const p = Math.min(1, Math.max(0, progress));
  const state = p <= 0.1 ? 'danger' : p <= 0.25 ? 'warn' : 'ok';
  const fill = state === 'danger' ? 'bg-danger' : state === 'warn' ? 'bg-warn' : 'bg-action';
  const track = tone === 'on-dark' ? 'bg-surface/20' : 'bg-mist-soft';
  const numColor = state === 'danger' ? 'text-danger' : tone === 'on-dark' ? 'text-surface' : 'text-ink';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('h-3 flex-1 overflow-hidden rounded-full', track)}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-200 ease-linear', fill)}
          style={{ width: `${p * 100}%` }}
        />
      </div>
      {secondsLeft !== undefined ? (
        <span className={cn('w-10 text-right font-sans text-[18px] font-bold tabular-nums', numColor)}>
          {Math.max(0, Math.ceil(secondsLeft))}
        </span>
      ) : null}
    </div>
  );
}
