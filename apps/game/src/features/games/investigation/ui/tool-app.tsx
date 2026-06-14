import { useState } from 'react';

import { cn } from '@gbedity/ui';
import { CircleCheck, CircleSlash, Database, Fingerprint, MapPin, PhoneCall, Radio, Search, type LucideIcon } from '@icons';

import type { LookupResult, MockTool } from '../preview/mock-case.ts';

// Investigative "apps" — Identity Lookup, Phone Records, Call Log, Cell Triangulation, Crime DB.
// `ToolBody` is the query selector + result for the accordion; the section builds the summary row
// (the tool name). A result is a HIT, PARTIAL, or DEAD END (no result — the twist).

export const TOOL_ICON: Record<MockTool['icon'], LucideIcon> = {
  identity: Fingerprint,
  phone_records: PhoneCall,
  call_log: Search,
  triangulation: Radio,
  crime_db: Database,
};

const OUTCOME = {
  hit: { label: 'Result found', cls: 'bg-action-soft text-action-deep', Icon: CircleCheck },
  partial: { label: 'Partial result', cls: 'bg-warn-soft text-warn-deep', Icon: MapPin },
  dead_end: { label: 'No result', cls: 'bg-mist-soft text-ink-3', Icon: CircleSlash },
} as const;

export function ToolBody({ tool }: { readonly tool: MockTool }) {
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const result = tool.results.find((r) => r.query === activeQuery) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[12px] text-ink-3">{tool.tagline}</p>
      <div className="flex flex-wrap gap-2">
        {tool.results.map((r) => (
          <button
            key={r.query}
            type="button"
            onClick={() => setActiveQuery(r.query)}
            className={cn(
              'rounded-full border px-3 py-1.5 font-sans text-[12px] font-bold transition-colors',
              activeQuery === r.query ? 'border-stage bg-stage text-surface' : 'border-ink-5 bg-surface text-ink-2 hover:border-stage',
            )}
          >
            {r.query}
          </button>
        ))}
      </div>

      {result === null ? (
        <p className="rounded-[14px] bg-mist-soft px-4 py-6 text-center font-sans text-[13px] text-ink-3">Pick a query to run the search.</p>
      ) : (
        <ResultPanel result={result} />
      )}
    </div>
  );
}

function ResultPanel({ result }: { readonly result: LookupResult }) {
  const o = OUTCOME[result.outcome];
  return (
    <div className="rounded-[14px] border border-ink-5 bg-surface">
      <div className="flex items-center gap-2 border-b border-ink-5 px-4 py-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.08em]', o.cls)}>
          <o.Icon size={12} aria-hidden="true" />
          {o.label}
        </span>
      </div>
      <dl className="divide-y divide-ink-5">
        {result.rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{row.label}</dt>
            <dd className="text-right font-sans text-[13px] font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      {result.note !== undefined ? (
        <p className={cn('px-4 py-3 font-sans text-[12px] italic leading-[1.5]', result.outcome === 'dead_end' ? 'text-ink-3' : 'text-ink-2')}>{result.note}</p>
      ) : null}
    </div>
  );
}
