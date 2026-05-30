import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export interface PreviewRailProps {
  /** Small uppercase label at the top — e.g. "This round", "A sample argument". */
  label: string;
  children: ReactNode;
  className?: string;
  /** Sticky position at top of scroll container — true by default. */
  sticky?: boolean;
}

// Visual spec: design-system/projects/gbedity/preview/33-word-bomb-config.html
//                design-system/projects/gbedity/preview/37-pyc-config.html
//
// The right-side rail on every config screen. Frame is reusable; contents
// differ per game — pass PreviewStat children for mechanical predictions
// (Word Bomb) or arbitrary nodes for richer previews (PYC sample-argument-
// and-verdict). The frame stays constant; the content language follows the
// consequence the host is configuring.
export function PreviewRail({ label, children, className, sticky = true }: PreviewRailProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-3 self-start rounded-card bg-surface p-[22px]',
        sticky && 'sticky top-5',
        className,
      )}
    >
      <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      {children}
    </aside>
  );
}

export interface PreviewStatProps {
  /** Small label — e.g. "Estimated", "First bomb". */
  k: string;
  /** Big value — typically a number, optionally with a small inline unit. */
  v: ReactNode;
  /** Optional small unit appended after the value in Nunito. */
  unit?: ReactNode;
  className?: string;
}

/**
 * PreviewStat — the canonical canvas-mint stat block inside a PreviewRail.
 *
 * Visual spec: design-system/projects/gbedity/preview/33-word-bomb-config.html
 *
 * Use for mechanical predictions (Estimated 8min · First bomb 07s · etc).
 * Compose richer previews (sample argument cards, etc) as plain children
 * of PreviewRail when the content needs more than a label/value pair.
 */
export function PreviewStat({ k, v, unit, className }: PreviewStatProps) {
  return (
    <div className={cn('rounded-[14px] bg-canvas px-4 py-[14px]', className)}>
      <div className="text-[12px] font-bold text-ink-3">{k}</div>
      <div
        className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48' }}
      >
        {v}
        {unit !== undefined && unit !== null ? (
          <span className="ml-1 font-sans text-[13px] font-bold text-ink-3">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
