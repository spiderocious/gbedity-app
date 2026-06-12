import { useState } from 'react';

import { Button, Card, Input } from '@gbedity/ui';
import { ChevronRight, Search } from '@icons';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { formatDateTime, formatDuration } from '../../../shared/helpers/format-time.ts';
import { useGamePlays } from '../api/history-api.ts';

// Game-play history — a paginated, gameId-filterable list. Each row opens the play detail (which
// also hosts the session event replay).
export function HistoryScreen() {
  const navigate = useNavigate();
  const [gameIdInput, setGameIdInput] = useState('');
  const [gameId, setGameId] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const list = useGamePlays({ gameId, cursor });
  const plays = list.data?.data ?? [];

  function applyFilter() {
    const next = gameIdInput.trim();
    setGameId(next === '' ? undefined : next);
    setCursor(undefined);
    setCursorStack([]);
  }

  function nextPage() {
    const next = list.data?.nextCursor ?? null;
    if (next === null) return;
    setCursorStack((s) => [...s, cursor ?? '']);
    setCursor(next);
  }

  function prevPage() {
    setCursorStack((s) => {
      const copy = [...s];
      const prev = copy.pop();
      setCursor(prev === undefined || prev === '' ? undefined : prev);
      return copy;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">History</h1>
        <p className="font-sans text-[14px] text-ink-3">Every completed game-play. Open one to replay its event stream.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={gameIdInput}
            onChange={(e) => setGameIdInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(); }}
            placeholder="Filter by game id…"
          />
        </div>
        <Button variant="secondary" leadingIcon={<Search size={15} aria-hidden="true" />} onClick={applyFilter}>Filter</Button>
        {gameId !== undefined ? (
          <Button variant="ghost" onClick={() => { setGameIdInput(''); setGameId(undefined); setCursor(undefined); setCursorStack([]); }}>Clear</Button>
        ) : null}
      </div>

      {list.isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      ) : list.isError ? (
        <p className="font-sans text-[14px] text-danger-deep">Couldn’t load history.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {plays.map((p) => (
            <Card key={p.id} size="sm" className="flex cursor-pointer items-center justify-between gap-3 hover:bg-canvas" onClick={() => navigate(ROUTES.HISTORY_DETAIL(p.id))}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[14px] font-bold text-ink">{p.gameId}</span>
                  <span className="font-mono text-[11px] uppercase text-ink-3">{p.roomCode}</span>
                </div>
                <span className="font-sans text-[12px] text-ink-3">
                  {p.players.length} players · {formatDuration(p.endedAt - p.startedAt)} · {formatDateTime(p.createdAt)}
                </span>
              </div>
              <ChevronRight size={18} aria-hidden="true" className="flex-shrink-0 text-ink-3" />
            </Card>
          ))}
          {plays.length === 0 ? <p className="font-sans text-[14px] text-ink-3">No game-plays{gameId !== undefined ? ` for “${gameId}”` : ''} yet.</p> : null}

          {plays.length > 0 ? (
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" size="sm" disabled={cursorStack.length === 0} onClick={prevPage}>Previous</Button>
              <Button variant="ghost" size="sm" disabled={!(list.data?.hasMore ?? false)} onClick={nextPage}>Next</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
