import { Card } from '@gbedity/ui';

import type { ViewPatch } from '../../../shared/types/view.ts';

// Shared building blocks for the "race-by-closeness" family (Scrambled Word, Definition Race,
// Synonyms/Antonyms, Wordshot). All of them surface a live `ranked` feed during play and a big
// prompt; only the prompt label + the action type differ. Kept in their own file so the
// agent-owned flow-primitives.tsx isn't touched.

export interface RankedRow {
  readonly text: string;
  /** 0–100 closeness (scrambled/definition) OR raw points (wordshot) — caller picks the unit label. */
  readonly value: number;
  readonly name?: string;
}

// The live ranking strip: top-N guesses by closeness/points, refreshed every patch. Anonymous by
// default (race games hide who's winning until reveal) — pass a name to attribute.
export function RankedFeed({
  rows,
  unit = '%',
  emptyHint = 'No guesses yet…',
}: {
  readonly rows: readonly RankedRow[];
  readonly unit?: string;
  readonly emptyHint?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-center font-sans text-[14px] text-ink-3">{emptyHint}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li
          key={`${r.text}-${i}`}
          className="flex items-center justify-between gap-3 rounded-card border border-ink-5 bg-surface px-4 py-2.5"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-canvas font-sans text-[12px] font-extrabold text-ink-3">
              {i + 1}
            </span>
            <span className="font-sans text-[15px] font-semibold text-ink">{r.name ?? r.text}</span>
          </span>
          <span className="font-sans text-[14px] font-bold tabular-nums text-action-deep">
            {r.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Pull the live ranked feed off a patch into RankedRow[] (closeness games use `closeness`; wordshot
// uses `score`). Defensive — fields are optional/passthrough.
export function rankedRows(patch: ViewPatch | null): RankedRow[] {
  const ranked = Array.isArray(patch?.ranked) ? patch.ranked : [];
  return ranked.map((r) => ({
    text: typeof r.text === 'string' ? r.text : '',
    value: typeof r.closeness === 'number' ? r.closeness : typeof r.score === 'number' ? r.score : typeof r.points === 'number' ? r.points : 0,
    ...(typeof r.name === 'string' ? { name: r.name } : {}),
  }));
}

// The big prompt surface shared across race games (a scrambled word, a definition, a relation cue).
export function PromptCard({ eyebrow, prompt, mono = false }: { readonly eyebrow: string; readonly prompt: string; readonly mono?: boolean }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-2 py-7 text-center">
      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-4">{eyebrow}</span>
      <p className={`text-ink ${mono ? 'font-mono text-[34px] font-bold tracking-[0.2em]' : 'font-serif text-[26px] font-semibold leading-[1.2]'}`}>
        {prompt}
      </p>
    </Card>
  );
}
