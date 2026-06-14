import { cn } from '@gbedity/ui';
import { Quote } from '@icons';

import type { MockWitness } from '../preview/mock-case.ts';

// A witness statement. `WitnessBody` is the expanded quote for the accordion; the section builds the
// summary row (name + reliability chip). Not every statement is trustworthy — the chip says so.

export const RELIABILITY_META = {
  reliable: { label: 'Reliable', cls: 'bg-action-soft text-action-deep' },
  questionable: { label: 'Questionable', cls: 'bg-warn-soft text-warn-deep' },
  hostile: { label: 'Hostile', cls: 'bg-danger-soft text-danger-deep' },
} as const;

export function WitnessBody({ witness }: { readonly witness: MockWitness }) {
  return (
    <div className="flex gap-2">
      <Quote size={16} aria-hidden="true" className="mt-[2px] flex-shrink-0 text-ink-4" />
      <p className="font-sans text-[13px] leading-[1.55] text-ink-2">{witness.statement}</p>
    </div>
  );
}

export function WitnessCard({ witness }: { readonly witness: MockWitness }) {
  const r = RELIABILITY_META[witness.reliability];
  return (
    <article className="rounded-[18px] border border-ink-5 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[16px] font-semibold text-ink">{witness.name}</h3>
          <p className="truncate font-sans text-[12px] font-semibold text-ink-3">{witness.relation}</p>
        </div>
        <span className={cn('flex-shrink-0 rounded-full px-2.5 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.08em]', r.cls)}>{r.label}</span>
      </div>
      <div className="mt-3">
        <WitnessBody witness={witness} />
      </div>
    </article>
  );
}
