import { Card, Score } from '@gbedity/ui';

import { useGamePlays, useMetrics } from '../../shared/api/admin-api.ts';

// Metrics home — per-game play counts + recent game-plays (api-docs §metrics + §game-plays).
export function MetricsScreen() {
  const metrics = useMetrics();
  const plays = useGamePlays();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Metrics</h1>

      <section>
        <h2 className="mb-3 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">By game</h2>
        {metrics.isLoading ? (
          <p className="font-sans text-[14px] text-ink-3">Loading…</p>
        ) : metrics.isError ? (
          <p className="font-sans text-[14px] text-danger-deep">Couldn’t load metrics.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(metrics.data?.byGame ?? []).map((g) => (
              <Card key={g.gameId} size="sm" className="flex flex-col gap-1">
                <span className="font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">{g.gameId}</span>
                <Score value={g.plays} size="md" tone="ink" unit="plays" />
                <span className="font-sans text-[12px] text-ink-3">
                  avg {g.avgPlayers} players · {Math.round(g.avgDurationMs / 1000)}s
                </span>
              </Card>
            ))}
            {(metrics.data?.byGame.length ?? 0) === 0 ? (
              <p className="font-sans text-[14px] text-ink-3">No plays recorded yet.</p>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Recent game-plays</h2>
        {plays.isLoading ? (
          <p className="font-sans text-[14px] text-ink-3">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(plays.data ?? []).slice(0, 20).map((p) => (
              <Card key={p.id} size="sm" className="flex items-center justify-between">
                <span className="font-sans text-[14px] font-bold text-ink">{p.gameId}</span>
                <span className="font-sans text-[12px] text-ink-3">
                  {p.roomCode} · {p.players.length} players
                </span>
              </Card>
            ))}
            {(plays.data?.length ?? 0) === 0 ? (
              <p className="font-sans text-[14px] text-ink-3">No game-plays yet.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
