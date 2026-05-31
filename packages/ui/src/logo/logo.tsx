import type { HTMLAttributes } from 'react';

import { cn } from '../utils/cn.ts';

export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoVariant = 'full' | 'mark';

export interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  size?: LogoSize;
  /** 'full' — the "Gbedity" wordmark. 'mark' — the standalone "G" brand mark. */
  variant?: LogoVariant;
}

// Visual spec: design-system/projects/gbedity/branding.md §3 (typography)
//
// The wordmark is its own component so the header, auth screens, and loading
// states reuse one source (frontend persona + brand both require this). It is a
// Fraunces wordmark in Forest Ink now; swapping to an SVG mark later only touches
// this file. 'mark' renders the single-letter brand mark for tight spaces.
const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'text-[22px]',
  md: 'text-[30px]',
  lg: 'text-[42px]',
};

const WORDMARK = 'Gbedity';
const MARK = 'G';

export function Logo({ size = 'md', variant = 'full', className, ...rest }: Readonly<LogoProps>) {
  return (
    <span
      className={cn(
        'inline-block font-serif font-semibold leading-none tracking-[-0.02em] text-ink',
        SIZE_CLASSES[size],
        className,
      )}
      style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
      {...rest}
    >
      {variant === 'mark' ? MARK : WORDMARK}
    </span>
  );
}
