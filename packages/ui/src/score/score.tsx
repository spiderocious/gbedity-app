import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export type ScoreSize = 'sm' | 'md' | 'lg' | 'hero';
export type ScoreTone = 'ink' | 'accent' | 'danger' | 'warn' | 'action';

export interface ScoreProps {
  /** The number (or string for things like "78/100") to render. */
  value: ReactNode;
  size?: ScoreSize;
  tone?: ScoreTone;
  /** Optional suffix in smaller Nunito (e.g. "pts", "/100", "s"). */
  unit?: ReactNode;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/15-numerals.html
//
// Every number in Gbedity is set in Fraunces SemiBold with tabular numerals.
// Four sizes cover the three hero roles plus inline use:
//   sm   — inline score chip / small inline number (22px)
//   md   — score column in a ranked row (32px)
//   lg   — celebration score number, AI verdict (56–72px)
//   hero — bomb timer, the loudest number on the screen (92px)
const SIZE_CLASSES: Record<ScoreSize, string> = {
  sm: 'text-[22px] leading-none tracking-[-0.01em]',
  md: 'text-[32px] leading-none tracking-[-0.02em]',
  lg: 'text-[72px] leading-[0.95] tracking-[-0.03em]',
  hero: 'text-[92px] leading-[0.95] tracking-[-0.04em]',
};

const TONE_CLASSES: Record<ScoreTone, string> = {
  ink: 'text-ink',
  accent: 'text-accent-deep',
  danger: 'text-danger',
  warn: 'text-warn-deep',
  action: 'text-action-deep',
};

const UNIT_SIZE_CLASSES: Record<ScoreSize, string> = {
  sm: 'text-[10px] ml-[2px]',
  md: 'text-[12px] ml-[3px]',
  lg: 'text-[20px] ml-[2px]',
  hero: 'text-[24px] ml-[3px]',
};

export function Score({ value, size = 'md', tone = 'ink', unit, className }: ScoreProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-serif font-semibold tabular-nums',
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
      style={{ fontVariationSettings: size === 'hero' || size === 'lg' ? '"SOFT" 100, "opsz" 144' : '"SOFT" 100, "opsz" 48' }}
    >
      {value}
      {unit !== undefined && unit !== null ? (
        <span
          className={cn(
            'font-sans font-bold uppercase tracking-[0.06em] text-ink-3',
            UNIT_SIZE_CLASSES[size],
          )}
        >
          {unit}
        </span>
      ) : null}
    </span>
  );
}
