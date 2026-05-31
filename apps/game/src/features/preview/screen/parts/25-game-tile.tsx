import { GameTile, Pill } from '@gbedity/ui';
import { Bomb, Scale, Target } from '@icons';

import { PageHead, RefBlock } from './preview-canvas.tsx';

export function GameTilePart() {
  return (
    <div>
      <PageHead index="25 / DISPLAY" title="GameTile" subtitle="@gbedity/ui · game-tile" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        The signature catalogue tile. Category-tinted top with the game ID watermark, title, and
        tag. White body with meta + plain-English description. Three-up grid in the catalogue.
        Becomes a button when <code>onClick</code> is provided.
      </p>

      <RefBlock title="Three-up catalogue · the canonical use">
        <div className="grid grid-cols-3 gap-[10px]">
          <GameTile
            id={6}
            category="casual"
            tag="Quick"
            title="Word Bomb"
            meta="3–10 · 8m"
            description="Type a word before the bomb explodes."
            trailing={<Pill tone="action">Default</Pill>}
            onClick={() => undefined}
          />
          <GameTile
            id={12}
            category="brain"
            tag="Brain"
            title="Millionaire"
            meta="2–10 · 15m"
            description="Climb the money ladder one question at a time."
            onClick={() => undefined}
          />
          <GameTile
            id={14}
            category="party"
            tag="Party"
            title="Catch the Lie"
            meta="3–10 · 10m"
            description="Two truths and a lie — find the fib."
            onClick={() => undefined}
          />
          <GameTile
            id={1}
            category="casual"
            tag="Quick"
            title="Quizzes"
            meta="2–10 · 8m"
            description="Multiple choice. Faster correct, more points."
            onClick={() => undefined}
          />
          <GameTile
            id={15}
            category="party"
            tag="Party"
            title="Sketch & Guess"
            meta="3–12 · 12m"
            description="Draw it. The room guesses what it is."
            onClick={() => undefined}
          />
          <GameTile
            id={18}
            category="immersive"
            tag="Immersive"
            title="Plead Your Case"
            meta="AI · 2–10 · 12m"
            description="Argue your innocence. The AI rules."
            onClick={() => undefined}
          />
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="With signature icon — number demotes to a faint corner reference">
        <div className="grid grid-cols-3 gap-[10px]">
          <GameTile
            id={6}
            category="casual"
            tag="Quick"
            title="Word Bomb"
            meta="3–10 · 8m"
            description="Hold the bomb longer for more points."
            icon={<Bomb size={20} aria-hidden="true" />}
            onClick={() => undefined}
          />
          <GameTile
            id={5}
            category="casual"
            tag="Quick"
            title="Wordshot"
            meta="2–10 · 7m"
            description="A letter and a category. Answer fast."
            icon={<Target size={20} aria-hidden="true" />}
            onClick={() => undefined}
          />
          <GameTile
            id={18}
            category="immersive"
            tag="Immersive"
            title="Plead Your Case"
            meta="2–10 · 12m"
            description="Argue the defence. An AI scores it."
            icon={<Scale size={20} aria-hidden="true" />}
            onClick={() => undefined}
          />
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Static (not interactive) — used in the league queue preview">
        <div className="grid grid-cols-3 gap-[10px]">
          <GameTile
            id={17}
            category="immersive"
            tag="Immersive"
            title="Investigation"
            meta="2–8 · 30m"
            description="Read the file. Name the suspect."
          />
          <GameTile
            id={19}
            category="immersive"
            tag="Immersive"
            title="Presentation"
            meta="2–10 · 15m"
            description="Topic on screen. Defend it cold."
          />
        </div>
      </RefBlock>
    </div>
  );
}
