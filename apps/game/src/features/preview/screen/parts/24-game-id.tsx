import { GameId } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function GameIdPart() {
  return (
    <div>
      <PageHead index="24 / DISPLAY" title="GameId" subtitle="@gbedity/ui · game-id" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        The permanent brand-system element. Two-digit zero-pad, Fraunces SemiBold, tinted to
        the category at 55% opacity. The same <code>06</code> appears on the Word Bomb
        catalogue tile, the in-game header, the post-game header, the config chip, and league
        queue rows — it ties the platform together without competing with the per-game design.
      </p>

      <RefBlock title="By category — all four tints">
        <RefRow label="casual (action)">
          <GameId id={1} category="casual" />
          <GameId id={6} category="casual" />
          <GameId id={11} category="casual" />
        </RefRow>
        <RefRow label="brain (stage)">
          <GameId id={12} category="brain" />
        </RefRow>
        <RefRow label="party (special)">
          <GameId id={13} category="party" />
          <GameId id={15} category="party" />
        </RefRow>
        <RefRow label="immersive (ink)">
          <GameId id={17} category="immersive" />
          <GameId id={18} category="immersive" />
          <GameId id={19} category="immersive" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Sizes — sm in chrome, md on tiles, lg on config head">
        <RefRow label="sm">
          <GameId id={6} category="casual" size="sm" />
        </RefRow>
        <RefRow label="md (default)">
          <GameId id={6} category="casual" />
        </RefRow>
        <RefRow label="lg">
          <GameId id={6} category="casual" size="lg" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="In context — config head chip">
        <div className="-mx-[6px] flex items-center gap-4 px-[6px] py-2">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-canvas">
            <GameId id={6} category="casual" size="lg" />
          </div>
          <div>
            <p className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
              Word Bomb
            </p>
            <p className="mt-1 text-[13px] text-ink-3">Quick · Casual · 3–10 players</p>
          </div>
        </div>
      </RefBlock>
    </div>
  );
}
