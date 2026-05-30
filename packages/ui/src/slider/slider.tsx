import { useId, type ChangeEvent } from 'react';

import { cn } from '../utils/cn.ts';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/37-pyc-config.html
//                design-system/projects/gbedity/preview/12-selection.html
//
// Functional <input type="range"> styled to spec. Canvas-mint track, 2px ink-
// bordered white thumb. Used in PYC config (AI criteria weights), Wordshot
// (speed-vs-accuracy slider), Catch the Lie (scoring weight), and anywhere
// else a continuous 0–100% value lives.
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  disabled,
  className,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(Number(e.target.value));
  }

  return (
    <div
      className={cn('relative h-[6px] w-full', disabled === true && 'opacity-40', className)}
    >
      <div className="absolute inset-0 rounded-full bg-canvas" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 rounded-full bg-ink"
        style={{ width: `${pct}%` }}
      />
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled === true}
        aria-label={ariaLabel}
        className={cn(
          'absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none bg-transparent p-0 opacity-0',
          'focus:outline-none focus-visible:opacity-100',
          disabled === true && 'cursor-not-allowed',
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
