import { Button, DrawerService, Pill } from '@gbedity/ui';

import { FieldType, type FieldDescriptor, type KindDescriptor } from '../schema/field-types.ts';
import type { FieldValue, FormRecord } from '../schema/content-values.ts';

// Read-only view of one content record, rendered from the kind descriptor (so it stays in sync
// with the forms). Used by the "View" action. No mutation — just a labelled, readable dump.

function labelForOption(field: FieldDescriptor, value: string): string {
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

function ScalarRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-ink-5 py-2 last:border-b-0">
      <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <span className="whitespace-pre-wrap font-sans text-[14px] text-ink">{value === '' ? '—' : value}</span>
    </div>
  );
}

function FieldView({ field, value }: { readonly field: FieldDescriptor; readonly value: FieldValue }) {
  switch (field.type) {
    case FieldType.MULTI_SELECT: {
      const arr = (value as string[]) ?? [];
      return (
        <div className="flex flex-col gap-1 border-b border-ink-5 py-2 last:border-b-0">
          <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{field.label}</span>
          {arr.length === 0 ? (
            <span className="font-sans text-[14px] text-ink-3">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">{arr.map((v) => <Pill key={v} tone="default">{labelForOption(field, v)}</Pill>)}</div>
          )}
        </div>
      );
    }
    case FieldType.STRING_ARRAY: {
      const arr = ((value as string[]) ?? []).filter((s) => s.trim() !== '');
      return <ScalarRow label={field.label} value={arr.length === 0 ? '' : arr.join(', ')} />;
    }
    case FieldType.OBJECT_ARRAY: {
      const rows = (value as FormRecord[]) ?? [];
      return (
        <div className="flex flex-col gap-2 border-b border-ink-5 py-2 last:border-b-0">
          <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{field.label}</span>
          {rows.length === 0 ? (
            <span className="font-sans text-[14px] text-ink-3">—</span>
          ) : (
            rows.map((row, i) => (
              <div key={i} className="rounded-card border-2 border-mist-soft bg-canvas p-2">
                <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{field.label.replace(/s$/, '')} {i + 1}</span>
                {(field.fields ?? []).map((sub) => (
                  <FieldView key={sub.name} field={sub} value={row[sub.name] ?? ''} />
                ))}
              </div>
            ))
          )}
        </div>
      );
    }
    case FieldType.SELECT:
      return <ScalarRow label={field.label} value={value === '' ? '' : labelForOption(field, value as string)} />;
    default:
      return <ScalarRow label={field.label} value={value as string} />;
  }
}

interface ContentViewProps {
  readonly desc: KindDescriptor;
  readonly record: FormRecord;
  readonly onEdit?: () => void;
}

export function ContentView({ desc, record, onEdit }: ContentViewProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="font-serif text-[22px] font-semibold text-ink">{desc.label.replace(/s$/, '')}</h2>
      <div className="flex flex-col">
        {desc.fields.map((field) => (
          <FieldView key={field.name} field={field} value={record[field.name] ?? ''} />
        ))}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t-2 border-mist-soft bg-surface pt-3">
        {onEdit ? <Button variant="primary" className="flex-1" onClick={onEdit}>Edit</Button> : null}
        <Button variant="ghost" className={onEdit ? '' : 'flex-1'} onClick={() => DrawerService.closeModal()}>Close</Button>
      </div>
    </div>
  );
}
