import { z } from 'zod';

import { getPlugin } from '@engine/registry';
import { LINEUP_LIMITS, type LobbyLineupEntry } from '@engine/room/room.types';

// The lineup the host publishes to the room (PUT /rooms/:code/lineup). The host sends a slim,
// already-public summary per queued game — the "a few configs, not the whole thing" surface
// players see. The server treats it as opaque DATA but bounds it hard (length caps, max items,
// known gameId) since the room re-serves it to every other client. This is the acceptance guard,
// not a config-derivation engine: derivation of which facts are public is the host's job today
// (the host knows the human-readable labels it selected); the server's job is to keep the payload
// safe and small.

const FactInput = z.object({
  label: z.string().trim().min(1).max(LINEUP_LIMITS.MAX_LABEL_LEN),
  value: z.string().trim().min(1).max(LINEUP_LIMITS.MAX_VALUE_LEN),
});

const LineupEntryInput = z.object({
  gameId: z.string().min(1),
  title: z.string().trim().min(1).max(LINEUP_LIMITS.MAX_TITLE_LEN),
  facts: z.array(FactInput).max(LINEUP_LIMITS.MAX_FACTS_PER_GAME).default([]),
});

export const LineupInput = z.object({
  lineup: z.array(LineupEntryInput).max(LINEUP_LIMITS.MAX_GAMES),
});
export type LineupInput = z.infer<typeof LineupInput>;

// Map validated input to stored entries, dropping any entry whose gameId isn't a registered
// plugin (a stale/unknown id never reaches other clients). The gameId is re-typed via the
// plugin's own manifest id so what we store is the canonical GameId, not the raw string.
export function toLineupEntries(input: LineupInput): LobbyLineupEntry[] {
  const entries: LobbyLineupEntry[] = [];
  for (const item of input.lineup) {
    const plugin = getPlugin(item.gameId);
    if (!plugin) continue; // unknown game — skip, don't fail the whole publish
    entries.push({
      gameId: plugin.manifest.id,
      title: item.title,
      facts: item.facts,
    });
  }
  return entries;
}
