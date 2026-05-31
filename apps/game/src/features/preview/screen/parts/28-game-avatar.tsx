import { AvatarStack, GameAvatar } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const SEEDS = ['temi', 'ada', 'kemi', 'femi', 'zara', 'tunde', 'sola', 'lola', 'kofi', 'nneka', 'seyi', 'funmi', 'tolu', 'titi', 'bola'] as const;

export function GameAvatarPart() {
  return (
    <div>
      <PageHead index="28 / DISPLAY" title="GameAvatar" subtitle="@gbedity/ui · avatar" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        A DiceBear <code className="font-mono text-[12px]">adventurer-neutral</code> portrait seeded
        from a stable id, generated locally (no network). If generation fails — or the image can&apos;t
        render — it falls back to the seat-coloured initial Avatar. Seat colour and initial are both
        derived from the id, so a player always degrades to the same colour and letter.
      </p>

      <RefBlock title="Sizes · seeded portraits">
        <RefRow label="sm · 28">
          {SEEDS.slice(0, 3).map((id) => (
            <GameAvatar key={id} id={id} size="sm" />
          ))}
        </RefRow>
        <RefRow label="md · 40 (default)">
          {SEEDS.slice(0, 3).map((id) => (
            <GameAvatar key={id} id={id} />
          ))}
        </RefRow>
        <RefRow label="lg · 56">
          {SEEDS.slice(0, 2).map((id) => (
            <GameAvatar key={id} id={id} size="lg" />
          ))}
        </RefRow>
        <RefRow label="xl · 72">
          {SEEDS.slice(0, 2).map((id) => (
            <GameAvatar key={id} id={id} size="xl" />
          ))}
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Determinism · the same id always gives the same face">
        <RefRow label="id = temi">
          <GameAvatar id="temi" />
          <GameAvatar id="temi" />
          <GameAvatar id="temi" />
        </RefRow>
        <RefRow label="five distinct ids">
          {SEEDS.map((id) => (
            <GameAvatar key={id} id={id} />
          ))}
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Fallback · seat-coloured initial when DiceBear can't render">
        <RefRow label="empty id → '?'">
          <GameAvatar id="" />
        </RefRow>
        <RefRow label="override initial + seat">
          <GameAvatar id="" initial="K" seat={3} />
          <GameAvatar id="" initial="A" seat={5} />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Composes inside AvatarStack">
        <RefRow label="with overflow">
          <AvatarStack overflow={3}>
            {SEEDS.slice(0, 4).map((id) => (
              <GameAvatar key={id} id={id} />
            ))}
          </AvatarStack>
        </RefRow>
      </RefBlock>
    </div>
  );
}
