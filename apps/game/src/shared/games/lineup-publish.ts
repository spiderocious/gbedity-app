import type { PublishLineupEntry, PublishLineupFact } from '../api/use-set-lineup.ts';
import type { QueuedGame } from './game-queue.ts';

// Map the host's local queue → the slim public lineup published to the room. This is the "a few
// configs, not the whole thing" projection: title + a small whitelist of player-relevant,
// non-spoiler facts derived from the game's config. Custom content, weights, scoring internals,
// and anything that could spoil answers are deliberately NEVER included.
//
// Only backed games are published (a preview-only game has no backend id / isn't startable, so it
// shouldn't appear in the shared lineup as if it were queued to play).

// Config keys we're willing to surface, in display order, with a human label and a formatter.
// Unknown keys are ignored; absent keys are skipped — so a game with no config yields just a title.
const PUBLIC_FACTS: readonly {
  key: string;
  label: string;
  format: (value: unknown) => string | null;
}[] = [
  { key: 'rounds', label: 'Rounds', format: asCount },
  { key: 'count', label: 'Rounds', format: asCount },
  { key: 'secondsPerQuestion', label: 'Time each', format: asSeconds },
  { key: 'turnSeconds', label: 'Time per turn', format: asSeconds },
  { key: 'time', label: 'Time each', format: asSeconds },
  { key: 'difficulty', label: 'Difficulty', format: asText },
  { key: 'category', label: 'Theme', format: asText },
];

const MAX_FACTS = 3; // keep it glanceable — "a few", not the whole config

function asCount(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value);
  return null;
}

function asSeconds(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `${value}s`;
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function factsFor(config: Record<string, unknown>): PublishLineupFact[] {
  const facts: PublishLineupFact[] = [];
  const seenLabels = new Set<string>();
  for (const spec of PUBLIC_FACTS) {
    if (facts.length >= MAX_FACTS) break;
    if (seenLabels.has(spec.label)) continue; // don't show "Rounds" twice from rounds+count
    const formatted = spec.format(config[spec.key]);
    if (formatted !== null) {
      facts.push({ label: spec.label, value: formatted });
      seenLabels.add(spec.label);
    }
  }
  return facts;
}

export function queueToLineup(queue: readonly QueuedGame[]): PublishLineupEntry[] {
  return queue
    .filter((q): q is QueuedGame & { backendId: string } => q.backendId !== undefined)
    .map((q) => ({
      gameId: q.backendId,
      title: q.title,
      facts: factsFor(q.config),
    }));
}
