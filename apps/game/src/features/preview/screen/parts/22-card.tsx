import { Card } from '@gbedity/ui';

import { PageHead, RefBlock } from './preview-canvas.tsx';

export function CardPart() {
  return (
    <div>
      <PageHead index="22 / DISPLAY" title="Card" subtitle="@gbedity/ui · card" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Three sizes/tones. <strong>Small surface</strong> for dense scenes (config rows, modal
        bodies). <strong>Large surface</strong> for hero scenes (the room card, post-game
        celebrations). <strong>Canvas</strong> for nested zones inside a white card.
      </p>

      <RefBlock title="Small · surface · the default">
        <Card>
          <h3 className="font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink">
            Small card · 20px radius
          </h3>
          <p className="mt-1 text-[13px] text-ink-3">
            Used inside dense scenes — config option groups, modal bodies, side rails.
          </p>
        </Card>
      </RefBlock>

      <div className="h-4" />

      <RefBlock title="Large · surface · hero">
        <Card size="lg">
          <h3 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            Large card · 28px radius
          </h3>
          <p className="mt-1 text-[13px] text-ink-3">
            Hero scenes — the room card on the lobby, the celebration card on the post-game.
          </p>
        </Card>
      </RefBlock>

      <div className="h-4" />

      <RefBlock title="Canvas · nested zone">
        <Card size="lg">
          <h3 className="font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink">
            Outer white card
          </h3>
          <Card tone="canvas" className="mt-4">
            <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
              Nested canvas zone
            </p>
            <p className="mt-2 text-[14px] text-ink-2">
              Used for sub-zones inside a white card — preview rail stats, said-pill grounds.
            </p>
          </Card>
        </Card>
      </RefBlock>
    </div>
  );
}
