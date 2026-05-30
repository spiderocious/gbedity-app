import { useState } from 'react';

import { CategoryChip, Pill, type CategoryKey } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function PillPart() {
  const [active, setActive] = useState<CategoryKey | null>(null);

  return (
    <div>
      <PageHead index="20 / DISPLAY" title="Pill · CategoryChip" subtitle="@gbedity/ui · pill" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Pills carry state at a glance. Three families: <strong>state</strong> (Ready, Watching,
        Eliminated), <strong>category</strong> (Quick, Brain, Party, Immersive — see CategoryChip
        below), and <strong>celebration</strong> (score bubble, winner crown). Full-pill radius,
        uppercase Nunito 12px 700.
      </p>

      <RefBlock title="State pills (player chrome)">
        <RefRow label="tones">
          <Pill tone="action">Ready</Pill>
          <Pill tone="info">Watching</Pill>
          <Pill tone="warn">Choosing name</Pill>
          <Pill tone="danger">Eliminated</Pill>
          <Pill tone="special">Drawing</Pill>
          <Pill tone="accent">Your turn</Pill>
          <Pill>Spectator</Pill>
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Category chips · catalogue filter">
        <p className="mb-4 max-w-[60ch] text-[12px] text-ink-3">
          Active state uses the category tint (matching the catalogue tile top). Inactive
          recedes to white surface. Click to filter.
        </p>
        <RefRow label="all filters">
          <CategoryChip category="casual" active={active === null} onClick={() => setActive(null)}>
            All
          </CategoryChip>
          <CategoryChip
            category="casual"
            active={active === 'casual'}
            onClick={() => setActive('casual')}
          >
            Quick · Casual
          </CategoryChip>
          <CategoryChip
            category="brain"
            active={active === 'brain'}
            onClick={() => setActive('brain')}
          >
            Brain · Strategy
          </CategoryChip>
          <CategoryChip
            category="party"
            active={active === 'party'}
            onClick={() => setActive('party')}
          >
            Party · Social
          </CategoryChip>
          <CategoryChip
            category="immersive"
            active={active === 'immersive'}
            onClick={() => setActive('immersive')}
          >
            Immersive
          </CategoryChip>
        </RefRow>
        <RefRow label="static (no onClick)">
          <CategoryChip category="party" active>
            Party · Social
          </CategoryChip>
          <CategoryChip category="immersive">Immersive</CategoryChip>
        </RefRow>
      </RefBlock>
    </div>
  );
}
