import { type ReactNode } from 'react';

import { cn } from '@gbedity/ui';

// The "rules / facts" strip under the question card (inspiration: the RULES row). A small row of
// labelled facts — round count, time, points-on-offer — each with an icon. Pure presentation.

export interface MetaFact {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}

interface MetaStripProps {
  readonly facts: readonly MetaFact[];
  readonly className?: string;
}

export function MetaStrip({ facts, className }: MetaStripProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', className)}>
      {facts.map((f) => (
        <div key={f.label} className="flex items-center gap-3 rounded-[16px] bg-canvas px-4 py-3">
          <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-action">
            {f.icon}
          </span>
          <span className="min-w-0">
            <span className="block font-sans text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-3">
              {f.label}
            </span>
            <span className="block truncate font-sans text-[15px] font-bold text-ink">{f.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
