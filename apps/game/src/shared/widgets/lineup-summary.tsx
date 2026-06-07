import { GameId, Pill } from '@gbedity/ui';

import { findGame, useCatalogue } from '../catalogue/index.ts';
import type { LineupEntry } from '../types/api.ts';

export interface LineupSummaryProps {
  /** The room's published lineup (from the lobby snapshot). */
  readonly lineup: readonly LineupEntry[];
  /** Display surfaces render larger; default 'phone'. */
  readonly scale?: 'phone' | 'display';
}

// Read-only lineup the players + display see in the lobby. Renders each queued game with its
// catalogue GameId chip + title + the few public facts the host published (e.g. "Rounds · 5").
// Numbered when it's a multi-game league. Shared by the player and display lobbies so the two
// stay identical. Renders nothing when the host hasn't queued anything yet — the caller decides
// what to show in that empty case (its own "waiting" copy).
export function LineupSummary({ lineup, scale = 'phone' }: LineupSummaryProps) {
  const { data: catalogue } = useCatalogue();
  if (lineup.length === 0) return null;

  const isLeague = lineup.length > 1;
  const titleSize = scale === 'display' ? 'text-[22px]' : 'text-[15px]';
  const chipSize = scale === 'display' ? 'lg' : 'sm';

  return (
    <ul className="flex flex-col gap-2" aria-label="Game lineup">
      {lineup.map((entry, i) => {
        const g = findGame(catalogue ?? [], entry.gameId);
        return (
          <li
            key={`${entry.gameId}-${i}`}
            className="flex items-center gap-3 rounded-card bg-canvas px-3 py-3"
          >
            {isLeague ? (
              <span className="w-5 shrink-0 text-center font-serif text-[16px] font-semibold text-ink-3">
                {i + 1}
              </span>
            ) : null}
            {g !== undefined ? <GameId id={g.id} category={g.category} size={chipSize} /> : null}
            <div className="min-w-0 flex-1">
              <span className={`block truncate font-sans font-bold text-ink ${titleSize}`}>
                {entry.title}
              </span>
              {entry.facts.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.facts.map((f) => (
                    <Pill key={f.label} tone="default">
                      {f.label} · {f.value}
                    </Pill>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
