import { cn } from '@gbedity/ui';

// Slim horizontal timer bar + remaining seconds label for the question screen.
// `progress` is 0..1 (1 = full time, 0 = expired). Props-only.

interface QuestionClockProps {
  readonly progress: number; // 0..1
  readonly secondsLeft: number;
  readonly className?: string;
}

export function QuestionClock({ progress, secondsLeft, className }: QuestionClockProps) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const urgent = pct <= 25;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between font-sans text-[13px] font-bold text-ink-3">
        <span>Time</span>
        <span className={cn('tabular-nums', urgent && 'text-danger')}>{secondsLeft}s</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas-deep">
        <div
          role="progressbar"
          aria-valuenow={secondsLeft}
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-linear',
            urgent ? 'bg-danger' : 'bg-action',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
