import type { ReactNode } from 'react';

// Shared layout primitives for preview parts. Every part composes these so the
// gallery stays visually consistent as components are added.

interface PageHeadProps {
  readonly index: string;
  readonly title: string;
  readonly subtitle?: string;
}

export function PageHead({ index, title, subtitle }: PageHeadProps) {
  return (
    <div className="mb-9">
      <div className="mb-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        {index}
      </div>
      <h1 className="m-0 font-serif text-[42px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {title}
      </h1>
      {subtitle !== undefined && subtitle !== '' && (
        <p className="mt-2 font-sans text-[12px] font-semibold text-ink-3">{subtitle}</p>
      )}
    </div>
  );
}

interface SectionBreakProps {
  readonly label: string;
}

export function SectionBreak({ label }: SectionBreakProps) {
  return (
    <div className="my-12 flex items-center gap-4">
      <span className="block h-px w-6 bg-ink-5" />
      <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <span className="h-px flex-1 bg-ink-5" />
    </div>
  );
}

interface RefBlockProps {
  readonly title?: string;
  readonly children: ReactNode;
}

export function RefBlock({ title = 'Variants · sizes · states', children }: RefBlockProps) {
  return (
    <div className="rounded-card bg-surface p-[22px]">
      <div className="mb-3 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        {title}
      </div>
      {children}
    </div>
  );
}

interface RefRowProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function RefRow({ label, children }: RefRowProps) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4 border-b border-dashed border-ink-5 py-3 last:border-b-0">
      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
