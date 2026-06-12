import { FieldType, type FieldDescriptor, type KindDescriptor } from './field-types.ts';

// Generates the two copy targets for content authoring:
//   • Sample JSON  — a real, valid example item (and the array form) using each field's `sample`.
//   • LLM prompt   — a complete, self-contained brief that can be pasted straight into a chat LLM
//                    to generate ready-to-paste items: game description, per-field meaning + rules,
//                    self-references, uniqueness, and a worked example.
// Both read the SAME descriptors the forms + validation use, so they can't drift.

// ── Sample value per field ───────────────────────────────────────────────────
function sampleValue(field: FieldDescriptor): unknown {
  if (field.type === FieldType.OBJECT_ARRAY && field.fields) {
    // Verbatim example elements when provided — gives distinct, realistic rows.
    if (field.samples !== undefined && field.samples.length > 0) return field.samples;

    const one: Record<string, unknown> = {};
    for (const sub of field.fields) one[sub.name] = sampleValue(sub);
    // two elements read better than one when the minimum asks for >1
    if ((field.minItems ?? 0) > 1) {
      const two = { ...one };
      for (const sub of field.fields) {
        if (sub.unique === true && typeof one[sub.name] === 'string') {
          const base = String(one[sub.name]);
          const bumped = base.replace(/\d+$/, '') + '2';
          two[sub.name] = bumped === base ? `${base}-2` : bumped;
        } else {
          two[sub.name] = sampleValue(sub);
        }
      }
      return [one, two];
    }
    return [one];
  }
  if (field.sample !== undefined) return field.sample;
  // fall back to something type-appropriate
  switch (field.type) {
    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return field.default ?? 0;
    case FieldType.STRING_ARRAY:
    case FieldType.MULTI_SELECT:
      return [];
    case FieldType.SELECT:
      return field.options?.[0]?.value ?? '';
    default:
      return '';
  }
}

// Build a valid sample item. Self-referencing fields are resolved against the sample they point at,
// so e.g. solutionSuspectId actually equals one of the sample suspects' ids.
export function buildSample(desc: KindDescriptor): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of desc.fields) item[field.name] = sampleValue(field);

  for (const field of desc.fields) {
    if (field.selfRef === undefined) continue;
    const target = item[field.selfRef.field];
    if (Array.isArray(target) && target.length > 0) {
      const first = target[0] as Record<string, unknown>;
      const refValue = first[field.selfRef.element];
      if (typeof refValue === 'string') item[field.name] = refValue;
    }
  }
  return item;
}

export function sampleJsonText(desc: KindDescriptor): string {
  const one = buildSample(desc);
  return JSON.stringify(one, null, 2);
}

// The array form, ready to paste for a bulk add (two items for shape clarity).
export function sampleArrayText(desc: KindDescriptor): string {
  const a = buildSample(desc);
  const b = buildSample(desc);
  return JSON.stringify([a, b], null, 2);
}

// ── Field rule lines for the prompt ──────────────────────────────────────────
function typeWord(field: FieldDescriptor): string {
  switch (field.type) {
    case FieldType.NUMBER:
    case FieldType.ANSWER_INDEX:
      return 'integer';
    case FieldType.MULTI_SELECT:
      return 'array of enum strings';
    case FieldType.STRING_ARRAY:
      return 'array of strings';
    case FieldType.OBJECT_ARRAY:
      return 'array of objects';
    default:
      return 'string';
  }
}

function constraints(field: FieldDescriptor): string[] {
  const c: string[] = [];
  c.push(field.required === true ? 'required' : 'optional');
  if (field.unique === true) c.push('must be unique');
  if (field.options !== undefined) c.push(`one of: ${field.options.map((o) => o.value).join(' | ')}`);
  if (field.min !== undefined || field.max !== undefined) c.push(`range ${field.min ?? '?'}–${field.max ?? '?'}`);
  if (field.maxLength !== undefined) c.push(`max length ${field.maxLength}`);
  if (field.exactItems !== undefined) c.push(`exactly ${field.exactItems} items`);
  if (field.minItems !== undefined) c.push(`at least ${field.minItems} items`);
  if (field.optionsField !== undefined) c.push(`0-based index into ${field.optionsField}[]`);
  if (field.selfRef !== undefined) c.push(`must equal one of ${field.selfRef.field}[].${field.selfRef.element}`);
  return c;
}

function fieldLines(fields: readonly FieldDescriptor[], indent: string): string[] {
  const lines: string[] = [];
  for (const field of fields) {
    const head = `${indent}- "${field.name}" (${typeWord(field)}; ${constraints(field).join('; ')})`;
    lines.push(head);
    if (field.meaning !== undefined) lines.push(`${indent}    ${field.meaning}`);
    if (field.type === FieldType.OBJECT_ARRAY && field.fields) {
      lines.push(`${indent}    each object has:`);
      lines.push(...fieldLines(field.fields, `${indent}      `));
    }
  }
  return lines;
}

// The full drop-in prompt: paste into Claude/ChatGPT and it can generate valid items immediately.
export function buildPrompt(desc: KindDescriptor, count = 10): string {
  return [
    `You are generating content for a Nigerian party game. Produce ${count} "${desc.label}" items as a single JSON array.`,
    '',
    `WHAT THIS IS: ${desc.description}`,
    '',
    'Each item is a JSON object with these fields:',
    ...fieldLines(desc.fields, ''),
    '',
    'RULES:',
    '- Output ONLY a JSON array of objects — no markdown, no commentary, no code fences.',
    '- Include every required field on every item. Omit optional fields you have no value for (do not send null).',
    '- Respect every constraint above (enums, ranges, item counts, uniqueness, and references).',
    '- Where a field "must equal one of" another array, make sure the value actually appears there.',
    '- Keep it appropriate to the chosen ratingTier, and tag honestly.',
    '- Make the content fun, varied, and Nigerian-flavoured where natural; avoid duplicates.',
    '',
    'Here is one valid example item (match this shape exactly):',
    sampleJsonText(desc),
    '',
    `Now generate ${count} new, distinct items as a JSON array.`,
  ].join('\n');
}
