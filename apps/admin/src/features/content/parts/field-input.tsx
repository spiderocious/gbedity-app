import { Button, Checkbox, Field, Input } from '@gbedity/ui';
import { Plus, X } from '@icons';

import { FieldType, type FieldDescriptor } from '../schema/field-types.ts';
import { emptySubRecord, type FieldValue, type FieldErrors, type FormRecord } from '../schema/content-values.ts';

// Renders one descriptor field as a controlled input. Recursive: OBJECT_ARRAY fields render a
// repeater of nested FieldInputs. Errors are keyed by dotted path (field / field.i.subfield) so
// nested validation messages land on the right control.

interface FieldInputProps {
  readonly field: FieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly errors: FieldErrors;
  readonly path: string; // dotted key prefix for this field's own error
}

const inputClass =
  'rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[14px] text-ink focus:border-action focus:outline-none';

export function FieldInput({ field, value, onChange, errors, path }: FieldInputProps) {
  const error = errors[path];

  switch (field.type) {
    case FieldType.TEXTAREA:
      return (
        <Field label={field.label} htmlFor={path} error={error} helper={field.help}>
          <textarea
            id={path}
            rows={3}
            value={value as string}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </Field>
      );

    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return (
        <Field label={field.label} htmlFor={path} error={error} helper={field.help}>
          <Input id={path} type="number" inputMode="numeric" value={value as string} error={error !== undefined} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );

    case FieldType.SELECT:
      return (
        <Field label={field.label} htmlFor={path} error={error} helper={field.help}>
          <select id={path} value={value as string} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>
      );

    case FieldType.MULTI_SELECT: {
      const selected = value as string[];
      const toggle = (v: string, on: boolean) => onChange(on ? [...selected, v] : selected.filter((x) => x !== v));
      return (
        <Field label={field.label} error={error} helper={field.help}>
          <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
            {(field.options ?? []).map((opt) => (
              <Checkbox key={opt.value} checked={selected.includes(opt.value)} onChange={(on) => toggle(opt.value, on)} label={opt.label} id={`${path}-${opt.value}`} />
            ))}
          </div>
        </Field>
      );
    }

    case FieldType.STRING_ARRAY: {
      const items = value as string[];
      const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
      const add = () => onChange([...items, '']);
      const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
      return (
        <Field label={field.label} error={error} helper={field.help}>
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={`${path}-${i}`} className="flex items-center gap-2">
                <Input className="flex-1" value={item} onChange={(e) => set(i, e.target.value)} placeholder={`${field.label} ${i + 1}`} />
                <button type="button" aria-label="Remove" onClick={() => removeAt(i)} className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-canvas hover:text-danger">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" leadingIcon={<Plus size={14} aria-hidden="true" />} onClick={add}>Add {field.label.toLowerCase()}</Button>
          </div>
        </Field>
      );
    }

    case FieldType.OBJECT_ARRAY: {
      const rows = value as FormRecord[];
      const subFields = field.fields ?? [];
      const setRow = (i: number, row: FormRecord) => onChange(rows.map((r, idx) => (idx === i ? row : r)));
      const add = () => onChange([...rows, emptySubRecord(subFields)]);
      const removeAt = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
      return (
        <Field label={field.label} error={error} helper={field.help}>
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <div key={`${path}-${i}`} className="relative flex flex-col gap-3 rounded-card border-2 border-mist-soft bg-canvas p-3">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-3">{field.label.replace(/s$/, '')} {i + 1}</span>
                  <button type="button" aria-label="Remove" onClick={() => removeAt(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-danger">
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
                {subFields.map((sub) => (
                  <FieldInput
                    key={sub.name}
                    field={sub}
                    value={row[sub.name] ?? ''}
                    onChange={(v) => setRow(i, { ...row, [sub.name]: v })}
                    errors={errors}
                    path={`${path}.${i}.${sub.name}`}
                  />
                ))}
              </div>
            ))}
            <Button variant="secondary" size="sm" leadingIcon={<Plus size={14} aria-hidden="true" />} onClick={add}>Add {field.label.toLowerCase().replace(/s$/, '')}</Button>
          </div>
        </Field>
      );
    }

    default:
      return (
        <Field label={field.label} htmlFor={path} error={error} helper={field.help}>
          <Input id={path} value={value as string} error={error !== undefined} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}
