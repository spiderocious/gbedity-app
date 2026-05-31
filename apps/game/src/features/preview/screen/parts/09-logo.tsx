import { Logo } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function LogoPart() {
  return (
    <div>
      <PageHead index="09 / FOUNDATION" title="Logo" subtitle="@gbedity/ui · logo" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        The wordmark as a standalone, reusable component — header, auth, loading states all
        pull from one source. Fraunces SemiBold in Forest Ink for now; the same component
        swaps to an SVG mark later without touching call sites.
      </p>

      <RefBlock title="Full wordmark · sizes">
        <RefRow label="sm · 22">
          <Logo size="sm" />
        </RefRow>
        <RefRow label="md · 30 (default)">
          <Logo />
        </RefRow>
        <RefRow label="lg · 42">
          <Logo size="lg" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Mark · single letter for tight spaces">
        <RefRow label="sm">
          <Logo variant="mark" size="sm" />
        </RefRow>
        <RefRow label="md">
          <Logo variant="mark" />
        </RefRow>
        <RefRow label="lg">
          <Logo variant="mark" size="lg" />
        </RefRow>
      </RefBlock>
    </div>
  );
}
