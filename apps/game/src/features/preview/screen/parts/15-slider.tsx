import { useState } from 'react';

import { Slider } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function SliderPart() {
  const [legal, setLegal] = useState(50);
  const [persuasion, setPersuasion] = useState(30);
  const [precedent, setPrecedent] = useState(20);
  const [speed, setSpeed] = useState(50);

  return (
    <div>
      <PageHead index="15 / PRIMITIVES" title="Slider" subtitle="@gbedity/ui · slider" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Functional <code>{`<input type="range">`}</code> styled to spec. Canvas-mint track, 2px
        ink-bordered white thumb. Used in PYC config for the AI criteria weights, in Wordshot
        for speed-vs-accuracy, anywhere a continuous 0–100% value lives.
      </p>

      <RefBlock title="In context — PYC AI evaluation criteria">
        <div className="-mx-[6px] flex flex-col gap-4 px-[6px] py-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Legal soundness</div>
              <div className="mb-2 text-[11px] text-ink-3">How well grounded in the supplied laws</div>
              <Slider value={legal} onChange={setLegal} ariaLabel="Legal soundness weight" />
            </div>
            <span className="min-w-[48px] text-right font-serif text-[22px] font-semibold tabular-nums text-ink">
              {legal}%
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Persuasiveness</div>
              <div className="mb-2 text-[11px] text-ink-3">Rhetorical strength, narrative coherence</div>
              <Slider value={persuasion} onChange={setPersuasion} ariaLabel="Persuasiveness weight" />
            </div>
            <span className="min-w-[48px] text-right font-serif text-[22px] font-semibold tabular-nums text-ink">
              {persuasion}%
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Use of precedent</div>
              <div className="mb-2 text-[11px] text-ink-3">Does the argument cite the supplied cases</div>
              <Slider value={precedent} onChange={setPrecedent} ariaLabel="Use of precedent weight" />
            </div>
            <span className="min-w-[48px] text-right font-serif text-[22px] font-semibold tabular-nums text-ink">
              {precedent}%
            </span>
          </div>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="States">
        <RefRow label="0">
          <div className="w-[260px]">
            <Slider value={0} onChange={() => undefined} ariaLabel="Zero" />
          </div>
        </RefRow>
        <RefRow label="50">
          <div className="w-[260px]">
            <Slider value={speed} onChange={setSpeed} ariaLabel="Speed vs accuracy" />
          </div>
        </RefRow>
        <RefRow label="100">
          <div className="w-[260px]">
            <Slider value={100} onChange={() => undefined} ariaLabel="Max" />
          </div>
        </RefRow>
        <RefRow label="disabled">
          <div className="w-[260px]">
            <Slider value={40} onChange={() => undefined} disabled ariaLabel="Disabled" />
          </div>
        </RefRow>
      </RefBlock>
    </div>
  );
}
