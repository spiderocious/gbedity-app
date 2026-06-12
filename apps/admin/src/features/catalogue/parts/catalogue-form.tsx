import { useState } from 'react';

import { Button, DrawerService, Field, Input } from '@gbedity/ui';

import { ApiError } from '../../../shared/services/api-client.ts';
import type { CatalogueRow, CatalogueUpsert } from '../api/catalogue-api.ts';

// Create/edit form for a catalogue entry's presentation fields. Self-contained (manages its own
// state + closes itself) because DrawerService.openModal takes a static node. On submit it calls
// the supplied mutation; field_errors from a 422 land inline.

interface CatalogueFormProps {
  readonly row: CatalogueRow;
  readonly mode: 'create' | 'edit';
  readonly onSubmit: (values: CatalogueUpsert) => Promise<unknown>;
}

// Empty string ⇒ field omitted (optional). Returns the parsed number or undefined for blanks.
function parseOptionalInt(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function CatalogueForm({ row, mode, onSubmit }: CatalogueFormProps) {
  const entry = row.entry;
  const [description, setDescription] = useState(entry?.description ?? '');
  const [estMinutes, setEstMinutes] = useState(entry?.estMinutes !== undefined ? String(entry.estMinutes) : '');
  const [iconName, setIconName] = useState(entry?.iconName ?? '');
  const [minOverride, setMinOverride] = useState(entry?.playersMinOverride !== undefined ? String(entry.playersMinOverride) : '');
  const [maxOverride, setMaxOverride] = useState(
    entry?.playersMaxOverride !== undefined && entry.playersMaxOverride !== null ? String(entry.playersMaxOverride) : '',
  );
  const [sortOrder, setSortOrder] = useState(entry?.sortOrder !== undefined ? String(entry.sortOrder) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function validate(): CatalogueUpsert | null {
    const next: Record<string, string> = {};
    if (description.trim() === '') next.description = 'Required.';
    else if (description.length > 280) next.description = 'Max 280 characters.';

    const est = parseOptionalInt(estMinutes);
    if (est === undefined) next.estMinutes = 'Required.';
    else if (Number.isNaN(est) || est <= 0 || est > 120) next.estMinutes = 'A whole number 1–120.';

    if (iconName.trim() === '') next.iconName = 'Required.';

    const min = parseOptionalInt(minOverride);
    if (min !== undefined && (Number.isNaN(min) || min <= 0)) next.playersMinOverride = 'A positive whole number.';

    const max = parseOptionalInt(maxOverride);
    if (max !== undefined && (Number.isNaN(max) || max <= 0)) next.playersMaxOverride = 'A positive whole number.';

    const sort = parseOptionalInt(sortOrder);
    if (sort !== undefined && (Number.isNaN(sort) || sort < 0)) next.sortOrder = 'Zero or a positive whole number.';

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      description: description.trim(),
      estMinutes: est as number,
      iconName: iconName.trim(),
      ...(min !== undefined && { playersMinOverride: min }),
      ...(max !== undefined && { playersMaxOverride: max }),
      ...(sort !== undefined && { sortOrder: sort }),
    };
  }

  function submit() {
    const values = validate();
    if (values === null) return;
    setPending(true);
    void onSubmit(values)
      .then(() => {
        DrawerService.closeModal();
        DrawerService.toast(mode === 'create' ? 'Added to catalogue.' : 'Saved.', { tone: 'success' });
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
        DrawerService.toast(e instanceof ApiError ? e.message : 'Could not save.', { tone: 'danger' });
      })
      .finally(() => setPending(false));
  }

  return (
    <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="font-serif text-[22px] font-semibold text-ink">
          {mode === 'create' ? 'Add to catalogue' : 'Edit catalogue entry'}
        </h2>
        <p className="font-sans text-[13px] text-ink-3">{row.title ?? row.gameId}</p>
      </div>

      <Field label="Description" htmlFor="cat-description" error={errors.description} helper="Shown on the landing showcase. Max 280 characters.">
        <textarea
          id="cat-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[14px] text-ink focus:border-action focus:outline-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Est. minutes" htmlFor="cat-est" error={errors.estMinutes}>
          <Input id="cat-est" type="number" inputMode="numeric" value={estMinutes} error={errors.estMinutes !== undefined} onChange={(e) => setEstMinutes(e.target.value)} placeholder="7" />
        </Field>
        <Field label="Icon name" htmlFor="cat-icon" error={errors.iconName} helper="A lucide icon name.">
          <Input id="cat-icon" value={iconName} error={errors.iconName !== undefined} onChange={(e) => setIconName(e.target.value)} placeholder="Sparkles" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Min players" htmlFor="cat-min" error={errors.playersMinOverride} helper="Optional override.">
          <Input id="cat-min" type="number" inputMode="numeric" value={minOverride} error={errors.playersMinOverride !== undefined} onChange={(e) => setMinOverride(e.target.value)} placeholder="—" />
        </Field>
        <Field label="Max players" htmlFor="cat-max" error={errors.playersMaxOverride} helper="Optional override.">
          <Input id="cat-max" type="number" inputMode="numeric" value={maxOverride} error={errors.playersMaxOverride !== undefined} onChange={(e) => setMaxOverride(e.target.value)} placeholder="—" />
        </Field>
        <Field label="Sort order" htmlFor="cat-sort" error={errors.sortOrder} helper="Optional.">
          <Input id="cat-sort" type="number" inputMode="numeric" value={sortOrder} error={errors.sortOrder !== undefined} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1" loading={pending} onClick={submit}>
          {mode === 'create' ? 'Add' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={() => DrawerService.closeModal()}>Cancel</Button>
      </div>
    </div>
  );
}
