import { FieldInput } from './field-input.tsx';
import type { KindDescriptor } from '../schema/field-types.ts';
import type { FieldErrors, FieldValue, FormRecord } from '../schema/content-values.ts';

// A controlled typed form for ONE content record. Parent owns the record + errors so this composes
// into both the single-create path and the multi-item review list (N forms at once).

interface ContentRecordFormProps {
  readonly desc: KindDescriptor;
  readonly record: FormRecord;
  readonly errors: FieldErrors;
  readonly onChange: (record: FormRecord) => void;
}

export function ContentRecordForm({ desc, record, errors, onChange }: ContentRecordFormProps) {
  function setField(name: string, value: FieldValue) {
    onChange({ ...record, [name]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      {desc.fields.map((field) => (
        <FieldInput
          key={field.name}
          field={field}
          value={record[field.name] ?? ''}
          onChange={(v) => setField(field.name, v)}
          errors={errors}
          path={field.name}
        />
      ))}
    </div>
  );
}
