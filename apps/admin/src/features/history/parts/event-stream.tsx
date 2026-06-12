import { useState } from 'react';

import { Card, Pill } from '@gbedity/ui';
import { ChevronDown, ChevronRight } from '@icons';
import type { UseQueryResult } from '@tanstack/react-query';

import { formatDateTime } from '../../../shared/helpers/format-time.ts';
import type { SessionEvent } from '../api/history-api.ts';

// The ordered session event stream for one game instance. Each row shows seq / time / type; the
// raw `data` payload expands on click.

function EventRow({ event }: { readonly event: SessionEvent }) {
  const [open, setOpen] = useState(false);
  const hasData = Object.keys(event.data).length > 0;
  return (
    <div className="border-b border-ink-5 last:border-b-0">
      <button type="button" disabled={!hasData} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default">
        <span className="w-8 flex-shrink-0 font-mono text-[11px] text-ink-3">{event.seq}</span>
        {hasData ? (open ? <ChevronDown size={14} aria-hidden="true" className="text-ink-3" /> : <ChevronRight size={14} aria-hidden="true" className="text-ink-3" />) : <span className="w-[14px] flex-shrink-0" />}
        <Pill tone="info">{event.type}</Pill>
        <span className="ml-auto flex-shrink-0 font-mono text-[11px] text-ink-3">{formatDateTime(event.at)}</span>
      </button>
      {open && hasData ? (
        <pre className="overflow-x-auto bg-canvas px-3 py-2 font-mono text-[11px] leading-[1.5] text-ink-2">{JSON.stringify(event.data, null, 2)}</pre>
      ) : null}
    </div>
  );
}

export function EventStream({ query }: { readonly query: UseQueryResult<SessionEvent[]> }) {
  if (query.isLoading) return <p className="font-sans text-[14px] text-ink-3">Loading events…</p>;
  if (query.isError) return <p className="font-sans text-[14px] text-danger-deep">Couldn’t load events.</p>;

  const events = query.data ?? [];
  if (events.length === 0) return <p className="font-sans text-[14px] text-ink-3">No events recorded for this session.</p>;

  return (
    <Card size="sm" className="flex flex-col p-0">
      {events.map((event) => (
        <EventRow key={event.seq} event={event} />
      ))}
    </Card>
  );
}
