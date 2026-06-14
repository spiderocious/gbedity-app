import { useState } from 'react';

import { Button, Segmented, cn } from '@gbedity/ui';
import { ArrowLeft } from '@icons';

import { SuspectCard } from '../ui/suspect-card.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import type { MockCase } from '../preview/mock-case.ts';

// ACCUSE — build your case, don't just guess. Three steps on one slide: name the culprit, point to
// the evidence that proves it, and set your confidence. Reasoned accusations score more than a
// coin-flip. Pure UI — the parent owns what happens on lock-in.

const Confidence = { HUNCH: 'Hunch', SOLID: 'Solid', CERTAIN: 'Certain' } as const;
type Confidence = (typeof Confidence)[keyof typeof Confidence];

interface AccuseScreenProps {
  readonly theCase: MockCase;
  readonly onBack: () => void;
  readonly onSubmit: (accusation: { suspectId: string; evidenceId: string; confidence: Confidence }) => void;
}

export function AccuseScreen({ theCase, onBack, onSubmit }: AccuseScreenProps) {
  const [suspectId, setSuspectId] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence>(Confidence.SOLID);

  const ready = suspectId !== null && evidenceId !== null;

  return (
    <SlideFrame tone={SlideTone.CANVAS} compact>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.16em] text-ink-3">Make your accusation</span>
          <h1 className="font-serif text-[30px] font-semibold tracking-[-0.01em] text-ink">Who did it — and how do you know?</h1>
        </div>

        {/* Step 1 — the culprit */}
        <section className="flex flex-col gap-3">
          <Step n={1} label="Name your suspect" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {theCase.suspects.map((s) => (
              <SuspectCard key={s.id} suspect={s} compact selected={suspectId === s.id} onSelect={() => setSuspectId(s.id)} />
            ))}
          </div>
        </section>

        {/* Step 2 — the proof */}
        <section className="flex flex-col gap-3">
          <Step n={2} label="Point to the evidence that proves it" />
          <div className="flex flex-col gap-2">
            {theCase.reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setEvidenceId(r.id)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-[14px] border-2 bg-surface px-4 py-3 text-left transition-colors',
                  evidenceId === r.id ? 'border-action bg-action-soft' : 'border-ink-5 hover:border-action',
                )}
              >
                <div className="min-w-0">
                  <span className="block truncate font-sans text-[14px] font-bold text-ink">{r.title}</span>
                  <span className="block truncate font-sans text-[12px] text-ink-3">{r.subtitle}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 3 — confidence */}
        <section className="flex flex-col gap-3">
          <Step n={3} label="How sure are you?" />
          <Segmented
            value={confidence}
            onChange={setConfidence}
            ariaLabel="Confidence"
            options={[Confidence.HUNCH, Confidence.SOLID, Confidence.CERTAIN].map((c) => ({ value: c, label: c }))}
          />
          <p className="font-sans text-[12px] text-ink-3">Higher confidence scores more if you’re right — and costs more if you’re wrong.</p>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={onBack} leadingIcon={<ArrowLeft size={18} aria-hidden="true" />}>
            Keep investigating
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!ready}
            onClick={() => ready && onSubmit({ suspectId: suspectId, evidenceId: evidenceId, confidence })}
          >
            Lock in accusation
          </Button>
        </div>
      </div>
    </SlideFrame>
  );
}

function Step({ n, label }: { readonly n: number; readonly label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-extrabold text-surface">{n}</span>
      <span className="font-sans text-[14px] font-extrabold text-ink">{label}</span>
    </div>
  );
}
