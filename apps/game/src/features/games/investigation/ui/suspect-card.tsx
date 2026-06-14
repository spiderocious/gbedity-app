import { GameAvatar, cn } from '@gbedity/ui';
import { Phone } from '@icons';

import type { MockSuspect } from '../preview/mock-case.ts';

// Suspect dossier. Two uses:
//  • SuspectCard — a full standalone card (used on the accuse step, optionally selectable).
//  • SuspectBody — the expanded detail only (motive/alibi/phone/note) for the accordion; the section
//    builds the summary row (avatar + name + alibi chip) itself.

export const ALIBI_META = {
  confirmed: { label: 'Alibi confirmed', cls: 'bg-action-soft text-action-deep' },
  shaky: { label: 'Alibi shaky', cls: 'bg-warn-soft text-warn-deep' },
  broken: { label: 'Alibi broken', cls: 'bg-danger-soft text-danger-deep' },
  unchecked: { label: 'Alibi unverified', cls: 'bg-mist-soft text-ink-3' },
} as const;

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <p className="font-sans text-[13px] leading-[1.45] text-ink-2">{value}</p>
    </div>
  );
}

export function SuspectBody({ suspect }: { readonly suspect: MockSuspect }) {
  return (
    <div className="flex flex-col gap-2">
      <Field label="Motive" value={suspect.motive} />
      <Field label="Alibi" value={suspect.alibi} />
      <div className="flex items-center gap-2 pt-1">
        <Phone size={13} aria-hidden="true" className="text-ink-4" />
        <span className="font-sans text-[12px] font-semibold tabular-nums text-ink-3">{suspect.phone}</span>
      </div>
      <p className="rounded-[12px] bg-mist-soft px-3 py-2 font-sans text-[12px] italic leading-[1.5] text-ink-3">{suspect.note}</p>
    </div>
  );
}

interface SuspectCardProps {
  readonly suspect: MockSuspect;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
  readonly guilty?: boolean;
  readonly compact?: boolean;
}

export function SuspectCard({ suspect, selected, onSelect, guilty, compact }: SuspectCardProps) {
  const alibi = ALIBI_META[suspect.alibiHolds];
  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      {...(onSelect ? { type: 'button' as const, onClick: onSelect } : {})}
      className={cn(
        'flex w-full flex-col gap-3 rounded-[18px] border-2 bg-surface p-4 text-left transition-colors',
        guilty ? 'border-danger bg-danger-soft' : selected ? 'border-action bg-action-soft' : 'border-ink-5',
        onSelect ? 'hover:border-action focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2' : '',
      )}
    >
      <div className="flex items-center gap-3">
        <GameAvatar id={suspect.id + suspect.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-serif text-[18px] font-semibold text-ink">{suspect.name}</h3>
            <span className="font-sans text-[12px] font-bold text-ink-3">{suspect.age}</span>
          </div>
          <p className="truncate font-sans text-[12px] font-semibold text-ink-3">{suspect.role}</p>
        </div>
        <span className={cn('flex-shrink-0 rounded-full px-2.5 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.08em]', alibi.cls)}>
          {alibi.label}
        </span>
      </div>
      {!compact ? <SuspectBody suspect={suspect} /> : null}
    </Wrapper>
  );
}
