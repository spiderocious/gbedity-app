import { PreviewRail, PreviewStat } from '@gbedity/ui';

import { PageHead, RefBlock } from './preview-canvas.tsx';

export function PreviewRailPart() {
  return (
    <div>
      <PageHead
        index="27 / DISPLAY"
        title="PreviewRail · PreviewStat"
        subtitle="@gbedity/ui · preview-rail"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        The right-side rail on every config screen — pre-empts "did I configure this right?"
        anxiety. The frame is reusable; contents differ per game. Use{' '}
        <strong>PreviewStat</strong> for mechanical predictions (Word Bomb). Compose richer
        content as plain children (PYC sample argument + verdict).
      </p>

      <RefBlock title="Word Bomb · mechanical predictions (PreviewStat children)">
        <div className="-mx-[6px] grid max-w-[420px] gap-3 px-[6px] py-2">
          <PreviewRail label="This round" sticky={false}>
            <PreviewStat k="Estimated" v="~ 8" unit="min" />
            <PreviewStat k="First bomb" v="07" unit="s" />
            <PreviewStat k="Eliminations available" v="9" unit="lives" />
            <PreviewStat k="Estimated words" v="~ 60" />
          </PreviewRail>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Plead Your Case · arbitrary children (sample argument + verdict)">
        <div className="-mx-[6px] grid max-w-[420px] gap-3 px-[6px] py-2">
          <PreviewRail label="A sample argument" sticky={false}>
            <div className="rounded-[14px] bg-canvas px-4 py-[14px] font-serif text-[14px] italic leading-[1.55] text-ink-2">
              <span className="mr-[2px] align-[-6px] text-[22px] leading-none text-ink-4">“</span>
              My client did not violate clause 3.b — the contract was voided when the second
              party failed to deliver by Friday, citing the <em>Adamu v. Lagos</em> precedent.
              <span className="ml-[2px] align-[-10px] text-[22px] leading-none text-ink-4">”</span>
            </div>

            <div className="mt-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
              Would score about
            </div>
            <div className="rounded-[16px] bg-ink px-[18px] py-4 text-white">
              <div className="mb-[6px] font-sans text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent">
                AI verdict · sample
              </div>
              <div
                className="font-serif text-[46px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
                style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
              >
                78
                <span className="ml-[2px] font-sans text-[18px] font-bold text-white/60">/100</span>
              </div>
              <div className="mt-2 text-[12px] leading-[1.55] text-white/[0.78]">
                Strong legal grounding (50%), cites supplied precedent (20%), moderate rhetoric
                (30%).
              </div>
            </div>
          </PreviewRail>
        </div>
      </RefBlock>
    </div>
  );
}
