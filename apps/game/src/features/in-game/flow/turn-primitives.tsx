import { Card } from '@gbedity/ui';

import type { ViewPatch } from '../../../shared/types/view.ts';
import { RoundScores, type ScoreRow } from './flow-primitives.tsx';

// Shared building blocks for the turn-based (round-robin) family — Word Bomb, Truth or Dare,
// Presentation, Millionaire. The common beat is "spotlight on the active player" + a running board.

// Whose turn it is, framed as a hero. `you` flips the copy to second person.
export function TurnSpotlight({
  name,
  you,
  subtitle,
  accent,
}: {
  readonly name: string;
  readonly you: boolean;
  readonly subtitle?: string;
  readonly accent?: string;
}) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ink-4">{you ? 'Your turn' : 'Now up'}</span>
      <p className="font-serif text-[34px] font-semibold leading-tight text-ink">{you ? 'You' : name}</p>
      {accent !== undefined ? <span className="rounded-full bg-action-soft px-3 py-1 font-sans text-[13px] font-bold text-action-deep">{accent}</span> : null}
      {subtitle !== undefined ? <p className="max-w-[40ch] font-sans text-[15px] text-ink-3">{subtitle}</p> : null}
    </Card>
  );
}

export function boardRows(patch: ViewPatch | null, nameOf: (id: string) => string): ScoreRow[] {
  return (patch?.board ?? []).map((b) => ({
    ...(b.playerId !== undefined ? { id: b.playerId } : {}),
    name: b.name ?? (b.playerId !== undefined ? nameOf(b.playerId) : '—'),
    points: typeof b.points === 'number' ? b.points : 0,
    roundDelta: typeof b.roundDelta === 'number' ? b.roundDelta : 0,
  }));
}

// A compact standings card for the turn games (always visible alongside the active turn).
export function StandingsCard({ patch, nameOf, title = 'Standings' }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string; readonly title?: string }) {
  const rows = boardRows(patch, nameOf);
  if (rows.length === 0) return null;
  return (
    <Card size="lg" className="py-5">
      <RoundScores title={title} rows={rows} />
    </Card>
  );
}
