import { useState, type ReactNode } from 'react';

import { cn } from '@gbedity/ui';
import { ChevronDown } from '@icons';

// A case-file accordion. Each record collapses to a single summary row (an icon, a title, an optional
// subtitle + trailing chip); tapping expands the full detail. Keeps the investigation workspace
// browsable instead of a wall of text. Self-contained open/close state; `defaultOpen` for the first
// item. Pure presentation otherwise.

export interface AccordionItemProps {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly trailing?: ReactNode; // a chip/status on the summary row
  readonly defaultOpen?: boolean;
  readonly children: ReactNode; // the expanded body
  readonly tone?: 'surface' | 'flag'; // `flag` tints the row (e.g. a key lead)
}

export function AccordionItem({ icon, title, subtitle, trailing, defaultOpen = false, children, tone = 'surface' }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('overflow-hidden rounded-[16px] border', tone === 'flag' ? 'border-action-edge bg-action-soft' : 'border-ink-5 bg-surface')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-mist-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-inset"
      >
        {icon !== undefined ? <span className="flex-shrink-0">{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-[15px] font-bold text-ink">{title}</span>
          {subtitle !== undefined ? <span className="block truncate font-sans text-[12px] text-ink-3">{subtitle}</span> : null}
        </span>
        {trailing !== undefined ? <span className="flex-shrink-0">{trailing}</span> : null}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn('flex-shrink-0 text-ink-4 transition-transform duration-200', open ? 'rotate-180' : '')}
        />
      </button>

      {open ? (
        <div className="border-t border-ink-5 px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}

// A thin wrapper so a whole section reads as one stacked accordion.
export function Accordion({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}
