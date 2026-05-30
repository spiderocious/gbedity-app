import { useState } from 'react';

import { Switch } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function SwitchPart() {
  const [autocorrect, setAutocorrect] = useState(false);
  const [bonus, setBonus] = useState(true);
  const [heckle, setHeckle] = useState(true);

  return (
    <div>
      <PageHead index="13 / PRIMITIVES" title="Switch" subtitle="@gbedity/ui · switch" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Binary on/off. Used in config screens for boolean toggles — autocorrect,
        audience-favourite bonus, allow-heckle-questions, anonymous voting. Canvas-mint when
        off; action-green when on.
      </p>

      <RefBlock title="In context — Presentation config">
        <div className="-mx-[6px] flex flex-col gap-1 px-[6px] py-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-ink-5 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Allow heckle questions</div>
              <div className="text-[11px] text-ink-3">Other players may submit one heckle each round</div>
            </div>
            <Switch checked={heckle} onChange={setHeckle} ariaLabel="Allow heckle questions" />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-ink-5 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Audience-favourite bonus</div>
              <div className="text-[11px] text-ink-3">Add a bonus round at the end</div>
            </div>
            <Switch checked={bonus} onChange={setBonus} ariaLabel="Audience-favourite bonus" />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
            <div>
              <div className="font-sans text-[14px] font-bold text-ink">Allow autocorrect</div>
              <div className="text-[11px] text-ink-3">
                When off, autocorrected answers are disqualified
              </div>
            </div>
            <Switch checked={autocorrect} onChange={setAutocorrect} ariaLabel="Allow autocorrect" />
          </div>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="States">
        <RefRow label="off">
          <Switch checked={false} onChange={() => undefined} ariaLabel="Off" />
        </RefRow>
        <RefRow label="on">
          <Switch checked={true} onChange={() => undefined} ariaLabel="On" />
        </RefRow>
        <RefRow label="disabled · off">
          <Switch checked={false} onChange={() => undefined} disabled ariaLabel="Disabled off" />
        </RefRow>
        <RefRow label="disabled · on">
          <Switch checked={true} onChange={() => undefined} disabled ariaLabel="Disabled on" />
        </RefRow>
      </RefBlock>
    </div>
  );
}
