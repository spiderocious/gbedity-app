import { Avatar, AvatarStack, type SeatIndex } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const SEATS: readonly SeatIndex[] = [1, 2, 3, 4, 5, 6, 7, 8];

export function AvatarPart() {
  return (
    <div>
      <PageHead index="21 / DISPLAY" title="Avatar · AvatarStack" subtitle="@gbedity/ui · avatar" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Initials in Nunito 800. Eight seat colours rotate from the brand secondary palette and
        are never duplicated within a single room. Four sizes: 28 · 40 · 56 · 72.
      </p>

      <RefBlock title="Sizes">
        <RefRow label="sm · 28">
          <Avatar initial="T" size="sm" />
          <Avatar initial="A" seat={2} size="sm" />
          <Avatar initial="F" seat={3} size="sm" />
        </RefRow>
        <RefRow label="md · 40 (default)">
          <Avatar initial="T" />
          <Avatar initial="A" seat={2} />
          <Avatar initial="F" seat={3} />
        </RefRow>
        <RefRow label="lg · 56">
          <Avatar initial="T" size="lg" />
          <Avatar initial="A" seat={2} size="lg" />
        </RefRow>
        <RefRow label="xl · 72">
          <Avatar initial="T" size="xl" />
          <Avatar initial="A" seat={2} size="xl" />
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Seat colours · all 8 in order">
        <RefRow label="ramp">
          {SEATS.map((seat) => (
            <Avatar key={seat} initial={String(seat)} seat={seat} />
          ))}
        </RefRow>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="AvatarStack · lobby summary at the top of the catalogue">
        <RefRow label="full">
          <AvatarStack>
            <Avatar initial="A" />
            <Avatar initial="T" seat={2} />
            <Avatar initial="F" seat={3} />
            <Avatar initial="K" seat={4} />
          </AvatarStack>
        </RefRow>
        <RefRow label="with overflow">
          <AvatarStack overflow={3}>
            <Avatar initial="A" />
            <Avatar initial="T" seat={2} />
            <Avatar initial="F" seat={3} />
            <Avatar initial="K" seat={4} />
          </AvatarStack>
        </RefRow>
        <RefRow label="sm stack">
          <AvatarStack overflow={5} size="sm">
            <Avatar initial="A" size="sm" />
            <Avatar initial="T" seat={2} size="sm" />
            <Avatar initial="F" seat={3} size="sm" />
          </AvatarStack>
        </RefRow>
      </RefBlock>
    </div>
  );
}
