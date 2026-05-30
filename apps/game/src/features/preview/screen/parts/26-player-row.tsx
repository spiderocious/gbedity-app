import { LobbyRow, Pill, RankedRow } from '@gbedity/ui';

import { PageHead, RefBlock } from './preview-canvas.tsx';

export function PlayerRowPart() {
  return (
    <div>
      <PageHead
        index="26 / DISPLAY"
        title="LobbyRow · RankedRow"
        subtitle="@gbedity/ui · player-row"
      />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Two registers of the same player. <strong>LobbyRow</strong> — warm canvas, used when
        there are no scores yet. <strong>RankedRow</strong> — hairline-separated, Fraunces
        tabular score, used post-game. Top rank tints accent.
      </p>

      <RefBlock title="LobbyRow · initial lobby (no scores)">
        <div className="flex flex-col gap-2">
          <LobbyRow initial="T" name="Tobi" meta="Joined 1m ago" trailing={<Pill tone="action">Ready</Pill>} />
          <LobbyRow
            initial="A"
            seat={2}
            name="Ada"
            meta="Joined 42s ago"
            trailing={<Pill tone="action">Ready</Pill>}
          />
          <LobbyRow
            initial="F"
            seat={3}
            name="Funmi"
            meta="Joined 12s ago"
            trailing={<Pill tone="info">Choosing name</Pill>}
          />
          <LobbyRow initial="K" seat={4} name="Kemi" trailing={<Pill tone="special">Spectator</Pill>} />
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="RankedRow · post-game leaderboard">
        <div>
          <RankedRow rank={1} initial="A" seat={1} name="Ada" score="1,420" isTop />
          <RankedRow rank={2} initial="T" seat={2} name="Tobi" score="1,180" />
          <RankedRow rank={3} initial="F" seat={3} name="Funmi" score="940" />
          <RankedRow rank={4} initial="K" seat={4} name="Kemi" score="720" />
        </div>
      </RefBlock>
    </div>
  );
}
