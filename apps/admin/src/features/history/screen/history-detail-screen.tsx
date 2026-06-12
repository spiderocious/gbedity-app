import { useState } from 'react';

import { Button, Card, RankedRow } from '@gbedity/ui';
import { ArrowLeft } from '@icons';
import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { formatDateTime, formatDuration } from '../../../shared/helpers/format-time.ts';
import { useGamePlay, useSessionEvents, type GamePlay } from '../api/history-api.ts';
import { EventStream } from '../parts/event-stream.tsx';

// A single game-play: summary + final board, then the session event replay (lazy-fetched on expand,
// keyed by the play id which is the game-instance id).

function nicknameFor(play: GamePlay, playerId: string): string {
  return play.players.find((p) => p.id === playerId)?.nickname ?? playerId;
}

export function HistoryDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const play = useGamePlay(id);
  const [showEvents, setShowEvents] = useState(false);
  const events = useSessionEvents(showEvents ? id : undefined);

  return (
    <div className="flex flex-col gap-6">
      <Link to={ROUTES.HISTORY} className="inline-flex w-fit items-center gap-1 font-sans text-[13px] font-bold text-ink-3 hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> History
      </Link>

      {play.isLoading ? (
        <p className="font-sans text-[14px] text-ink-3">Loading…</p>
      ) : play.isError || play.data === undefined ? (
        <p className="font-sans text-[14px] text-danger-deep">Couldn’t load this game-play.</p>
      ) : (
        <>
          <div>
            <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">{play.data.gameId}</h1>
            <p className="font-sans text-[14px] text-ink-3">
              Room {play.data.roomCode} · {play.data.players.length} players · {formatDuration(play.data.endedAt - play.data.startedAt)}
            </p>
            <p className="font-sans text-[12px] text-ink-3">
              {formatDateTime(play.data.startedAt)} → {formatDateTime(play.data.endedAt)}
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Final board</h2>
            {play.data.finalBoard.length === 0 ? (
              <p className="font-sans text-[14px] text-ink-3">No scores recorded.</p>
            ) : (
              <Card size="sm" className="flex flex-col gap-1">
                {[...play.data.finalBoard]
                  .sort((a, b) => b.points - a.points)
                  .map((entry, i) => {
                    const name = nicknameFor(play.data as GamePlay, entry.playerId);
                    return <RankedRow key={entry.playerId} rank={i + 1} initial={name.charAt(0).toUpperCase()} name={name} score={entry.points} isTop={i === 0} />;
                  })}
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Event replay</h2>
              {!showEvents ? <Button variant="secondary" size="sm" onClick={() => setShowEvents(true)}>Load events</Button> : null}
            </div>
            {showEvents ? <EventStream query={events} /> : <p className="font-sans text-[13px] text-ink-3">The full session event stream, in order.</p>}
          </section>
        </>
      )}
    </div>
  );
}
