// Field-descriptor model for content authoring. ONE descriptor per kind drives BOTH the typed
// form and the JSON-paste validation — so the two paths can never drift. The shapes mirror the
// backend zod schemas in apps/backend/src/features/admin/content-schemas.ts exactly.

export const FieldType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  SELECT: 'select', // single enum value
  MULTI_SELECT: 'multi_select', // array of enum values (e.g. tags)
  STRING_ARRAY: 'string_array', // editable list of free-text strings
  OBJECT_ARRAY: 'object_array', // repeater of sub-records (e.g. quiz questions, suspects)
  ANSWER_INDEX: 'answer_index', // 0-based index into a sibling options[] (quiz answer)
} as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

// How a field points at another field's value — used for self-references like
// solutionSuspectId → one of suspects[].id. `field` is the sibling array, `element` the property
// within each element whose value the reference must match.
export interface SelfRef {
  readonly field: string; // sibling OBJECT_ARRAY field name (e.g. 'suspects')
  readonly element: string; // property within each element (e.g. 'id')
}

export interface FieldDescriptor {
  readonly name: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly help?: string; // shown under the form input
  readonly meaning?: string; // a fuller, human/LLM-facing explanation of what this field IS
  readonly placeholder?: string;
  readonly unique?: boolean; // value must be unique (within the kind, or within the array for sub-fields)
  readonly selfRef?: SelfRef; // value must equal one of a sibling array's element properties
  readonly sample?: unknown; // a realistic example value used in generated samples/prompts
  // OBJECT_ARRAY only: full example elements used verbatim in samples (so a 2-suspect case shows
  // two distinct people). Falls back to per-sub-field `sample` when absent.
  readonly samples?: readonly Record<string, unknown>[];
  // SELECT
  readonly options?: readonly SelectOption[];
  // NUMBER / STRING_ARRAY / OBJECT_ARRAY bounds
  readonly min?: number;
  readonly max?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly exactItems?: number;
  readonly maxLength?: number;
  // NUMBER / SELECT default applied on a fresh form
  readonly default?: string | number;
  // OBJECT_ARRAY sub-fields
  readonly fields?: readonly FieldDescriptor[];
  // ANSWER_INDEX references the sibling array field whose length bounds it
  readonly optionsField?: string;
}

export interface KindDescriptor {
  readonly kind: string;
  readonly label: string;
  // Field used as the human label in lists (falls back through title/word/prompt/key/id).
  readonly titleField: string;
  // What the game is + how this content drives it. One or two sentences — the LLM brief leads with this.
  readonly description: string;
  readonly fields: readonly FieldDescriptor[];
}
