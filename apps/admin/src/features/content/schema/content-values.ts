import { FieldType, type FieldDescriptor, type KindDescriptor } from './field-types.ts';

// The form value model + the pure helpers that BOTH the typed form and the JSON-paste path use:
// build an empty record, coerce a pasted JSON object into the form model, validate against the
// descriptor, and serialise back to the API payload. Keeping this pure means the two entry paths
// share one definition of "valid" and can never drift.

// A flat-ish editable value tree. Scalars are strings (text/number/select), arrays are string[]
// (string_array / multi_select) or FormRecord[] (object_array).
export type FieldValue = string | string[] | FormRecord[];
export type FormRecord = Record<string, FieldValue>;

export type FieldErrors = Record<string, string>;

function emptyValue(field: FieldDescriptor): FieldValue {
  switch (field.type) {
    case FieldType.STRING_ARRAY:
    case FieldType.MULTI_SELECT:
      return [];
    case FieldType.OBJECT_ARRAY:
      return [];
    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return field.default !== undefined ? String(field.default) : '';
    case FieldType.SELECT:
      return field.default !== undefined ? String(field.default) : '';
    default:
      return '';
  }
}

export function emptyRecord(desc: KindDescriptor): FormRecord {
  const record: FormRecord = {};
  for (const field of desc.fields) record[field.name] = emptyValue(field);
  return record;
}

export function emptySubRecord(fields: readonly FieldDescriptor[]): FormRecord {
  const record: FormRecord = {};
  for (const field of fields) record[field.name] = emptyValue(field);
  return record;
}

// Coerce one raw JSON value into the form's value type for a field (lenient — validation happens
// after). Unknown/missing values fall back to the empty value.
function coerceValue(field: FieldDescriptor, raw: unknown): FieldValue {
  switch (field.type) {
    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return typeof raw === 'number' || typeof raw === 'string' ? String(raw) : emptyValue(field);
    case FieldType.SELECT:
    case FieldType.TEXT:
    case FieldType.TEXTAREA:
      return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : emptyValue(field);
    case FieldType.STRING_ARRAY:
    case FieldType.MULTI_SELECT:
      return Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : String(x))) : emptyValue(field);
    case FieldType.OBJECT_ARRAY:
      return Array.isArray(raw) && field.fields
        ? raw.map((item) => coerceSubRecord(field.fields as readonly FieldDescriptor[], item))
        : emptyValue(field);
    default:
      return emptyValue(field);
  }
}

function coerceSubRecord(fields: readonly FieldDescriptor[], raw: unknown): FormRecord {
  const obj = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const record: FormRecord = {};
  for (const field of fields) record[field.name] = coerceValue(field, obj[field.name]);
  return record;
}

// Turn a pasted JSON object into a fully-shaped form record for the kind (fills every field,
// defaulting anything missing). Caller validates afterwards.
export function recordFromJson(desc: KindDescriptor, raw: unknown): FormRecord {
  const obj = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const record: FormRecord = {};
  for (const field of desc.fields) record[field.name] = coerceValue(field, obj[field.name]);
  return record;
}

// ── Validation ───────────────────────────────────────────────────────────────
function isBlank(v: FieldValue): boolean {
  if (typeof v === 'string') return v.trim() === '';
  return v.length === 0;
}

function validateField(field: FieldDescriptor, value: FieldValue, errors: FieldErrors, prefix: string): void {
  const key = `${prefix}${field.name}`;

  if (field.type === FieldType.OBJECT_ARRAY) {
    const rows = Array.isArray(value) && typeof value[0] !== 'string' ? (value as FormRecord[]) : [];
    if (field.required === true && rows.length === 0) errors[key] = 'Add at least one.';
    if (field.minItems !== undefined && rows.length < field.minItems) errors[key] = `At least ${field.minItems}.`;
    rows.forEach((row, i) => {
      for (const sub of field.fields ?? []) validateField(sub, row[sub.name] ?? '', errors, `${key}.${i}.`);
    });
    return;
  }

  if (field.type === FieldType.STRING_ARRAY) {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const nonEmpty = arr.filter((s) => s.trim() !== '');
    if (field.required === true && nonEmpty.length === 0) errors[key] = 'Add at least one.';
    if (field.exactItems !== undefined && nonEmpty.length !== field.exactItems) errors[key] = `Exactly ${field.exactItems}.`;
    if (field.minItems !== undefined && nonEmpty.length < field.minItems) errors[key] = `At least ${field.minItems}.`;
    return;
  }

  if (field.type === FieldType.MULTI_SELECT) return; // optional everywhere it's used

  if (field.required === true && isBlank(value)) {
    errors[key] = 'Required.';
    return;
  }

  if ((field.type === FieldType.NUMBER || field.type === FieldType.ANSWER_INDEX) && !isBlank(value)) {
    const n = Number(value as string);
    if (!Number.isInteger(n)) errors[key] = 'A whole number.';
    else if (field.min !== undefined && n < field.min) errors[key] = `Min ${field.min}.`;
    else if (field.max !== undefined && n > field.max) errors[key] = `Max ${field.max}.`;
  }

  if (field.maxLength !== undefined && typeof value === 'string' && value.length > field.maxLength) {
    errors[key] = `Max ${field.maxLength} character${field.maxLength === 1 ? '' : 's'}.`;
  }
}

// Cross-field checks that need the whole record: self-references (a value must equal one of a
// sibling array's element ids) and uniqueness of ids within an object array.
function validateCrossField(desc: KindDescriptor, record: FormRecord, errors: FieldErrors): void {
  for (const field of desc.fields) {
    // Self-reference: e.g. solutionSuspectId must be one of suspects[].id.
    if (field.selfRef !== undefined && errors[field.name] === undefined) {
      const value = record[field.name];
      const target = record[field.selfRef.field];
      const rows = Array.isArray(target) && typeof target[0] !== 'string' ? (target as FormRecord[]) : [];
      const allowed = rows.map((r) => r[field.selfRef!.element]).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      if (typeof value === 'string' && value.trim() !== '' && !allowed.includes(value)) {
        errors[field.name] = `Must match one of ${field.selfRef.field}[].${field.selfRef.element}${allowed.length > 0 ? ` (${allowed.join(', ')})` : ''}.`;
      }
    }

    // Unique ids within an object array (e.g. each suspect/evidence id distinct).
    if (field.type === FieldType.OBJECT_ARRAY && field.fields) {
      const rows = Array.isArray(record[field.name]) ? (record[field.name] as FormRecord[]) : [];
      for (const sub of field.fields) {
        if (sub.unique !== true) continue;
        const seen = new Map<string, number>();
        rows.forEach((row, i) => {
          const v = row[sub.name];
          if (typeof v !== 'string' || v.trim() === '') return;
          if (seen.has(v)) {
            errors[`${field.name}.${i}.${sub.name}`] = 'Duplicate — must be unique.';
            const firstIdx = seen.get(v);
            if (firstIdx !== undefined) errors[`${field.name}.${firstIdx}.${sub.name}`] = 'Duplicate — must be unique.';
          } else {
            seen.set(v, i);
          }
        });
      }
    }
  }
}

export function validateRecord(desc: KindDescriptor, record: FormRecord): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of desc.fields) validateField(field, record[field.name] ?? '', errors, '');
  validateCrossField(desc, record, errors);
  return errors;
}

// ── Serialise to API payload ─────────────────────────────────────────────────
function serializeValue(field: FieldDescriptor, value: FieldValue): unknown {
  switch (field.type) {
    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return isBlank(value) ? undefined : Number(value as string);
    case FieldType.STRING_ARRAY:
      return (value as string[]).filter((s) => s.trim() !== '');
    case FieldType.MULTI_SELECT:
      return value as string[];
    case FieldType.OBJECT_ARRAY:
      return (value as FormRecord[]).map((row) => serializeRecord(field.fields ?? [], row));
    case FieldType.SELECT:
    case FieldType.TEXT:
    case FieldType.TEXTAREA:
      return isBlank(value) ? undefined : (value as string);
    default:
      return value;
  }
}

function serializeRecord(fields: readonly FieldDescriptor[], record: FormRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const v = serializeValue(field, record[field.name] ?? emptyValue(field));
    if (v !== undefined) out[field.name] = v;
  }
  return out;
}

export function recordToPayload(desc: KindDescriptor, record: FormRecord): Record<string, unknown> {
  return serializeRecord(desc.fields, record);
}

// The human label for a doc/record (uses the kind's titleField, falling back through common keys).
export function recordLabel(desc: KindDescriptor, record: FormRecord): string {
  const candidates = [desc.titleField, 'title', 'word', 'prompt', 'charge', 'topic', 'key', 'id'];
  for (const c of candidates) {
    const v = record[c];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return 'item';
}
