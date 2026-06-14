import { FileText, FlaskConical, Landmark, Smartphone, type LucideIcon } from '@icons';

import { cn } from '@gbedity/ui';

import type { MockReport } from '../preview/mock-case.ts';

// Forensic REPORT, designed to live inside an accordion: the section provides the summary row (kind
// + title), and `ReportBody` renders the quick header fields and the detailed findings on expand.
// Findings flag `key` (a real lead) vs `herring` (a deliberate misdirection). Pure presentation.

export const REPORT_KIND_META: Record<MockReport['kind'], { icon: LucideIcon; label: string }> = {
  forensic: { icon: FileText, label: 'Forensic' },
  autopsy: { icon: FlaskConical, label: 'Autopsy' },
  financial: { icon: Landmark, label: 'Financial' },
  digital: { icon: Smartphone, label: 'Digital' },
};

export function ReportBody({ report }: { readonly report: MockReport }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Quick fields */}
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-ink-5 bg-ink-5 sm:grid-cols-3">
        {report.fields.map((f) => (
          <div key={f.label} className="bg-surface px-4 py-2.5">
            <dt className="font-sans text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-3">{f.label}</dt>
            <dd className="mt-[2px] font-sans text-[14px] font-bold text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* Findings */}
      <div className="flex flex-col gap-2.5">
        {report.findings.map((fnd) => (
          <div
            key={fnd.heading}
            className={cn(
              'rounded-[12px] border px-4 py-3',
              fnd.flag === 'key' ? 'border-action-edge bg-action-soft' : fnd.flag === 'herring' ? 'border-ink-5 bg-mist-soft' : 'border-ink-5 bg-surface',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-[13px] font-extrabold text-ink">{fnd.heading}</span>
              {fnd.flag === 'key' ? (
                <span className="rounded-full bg-action px-2 py-[1px] font-sans text-[9px] font-extrabold uppercase tracking-[0.12em] text-surface">Lead</span>
              ) : null}
            </div>
            <p className="mt-1 font-sans text-[13px] leading-[1.5] text-ink-2">{fnd.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
