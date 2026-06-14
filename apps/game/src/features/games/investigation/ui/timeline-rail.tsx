import { cn } from '@gbedity/ui';
import { AlertTriangle } from '@icons';

import type { TimelineEvent } from '../preview/mock-case.ts';

// A vertical timeline of timestamped events with their source. Events that CONFLICT with an alibi or
// statement are flagged — those contradictions are where the case cracks open. Pure presentation.

export function TimelineRail({ events }: { readonly events: readonly TimelineEvent[] }) {
  return (
    <ol className="relative flex flex-col gap-4 pl-6">
      {/* The spine */}
      <span aria-hidden="true" className="absolute left-[7px] top-1 h-[calc(100%-0.5rem)] w-[2px] bg-ink-5" />
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className={cn(
              'absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-surface',
              e.conflict ? 'bg-danger' : 'bg-ink-4',
            )}
          />
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-[13px] font-extrabold tabular-nums text-ink">{e.time}</span>
            {e.conflict ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-[1px] font-sans text-[9px] font-extrabold uppercase tracking-[0.1em] text-danger-deep">
                <AlertTriangle size={10} aria-hidden="true" /> Conflicts
              </span>
            ) : null}
          </div>
          <p className="font-sans text-[13px] leading-[1.5] text-ink-2">{e.event}</p>
          <p className="font-sans text-[11px] font-semibold text-ink-4">Source: {e.source}</p>
        </li>
      ))}
    </ol>
  );
}
