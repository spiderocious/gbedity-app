import { useEffect, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { lobbyQueryKey } from '../api/use-lobby.ts';
import { useSetLineup } from '../api/use-set-lineup.ts';
import { sessionStore } from '../services/session-store.ts';
import { gameQueue, useGameQueue } from './game-queue.ts';
import { queueToLineup } from './lineup-publish.ts';

const DEBOUNCE_MS = 350;

// Host-only effect: mirror the local game queue to the room whenever it changes — add, REMOVE
// (the lobby's delete button), or reorder all flow through here, since they all mutate the
// reactive queue store. Debounced so a burst of edits publishes once. The host's local queue
// stays the editing source of truth; this is a one-way publish so players/display can see it.
//
// Mount once in the host lobby. No-ops when there's no host identity for the room (e.g. a
// non-host device viewing the lobby) — only the host may publish.
export function useSyncLineup(code: string): void {
  const queue = useGameQueue(code);
  const setLineup = useSetLineup();
  const queryClient = useQueryClient();
  const hostId = sessionStore.getHost()?.hostId;

  // Hold the latest mutate without making it an effect dependency (its identity changes each
  // render; we don't want that to retrigger the publish).
  const mutateRef = useRef(setLineup.mutate);
  mutateRef.current = setLineup.mutate;

  // Only PUT when the *published content* changes, not on every render. The signature also drives
  // the effect, so add/remove/reorder each publishes exactly once (after the debounce).
  const signature = JSON.stringify(queueToLineup(queue));

  useEffect(() => {
    if (code === '' || hostId === undefined) return undefined;
    const timer = window.setTimeout(() => {
      // Read the freshest queue at fire time in case several edits landed within the window.
      const lineup = queueToLineup(gameQueue.list(code));
      mutateRef.current(
        { code, hostId, lineup },
        {
          // Reflect the new lineup in the host's own lobby view immediately.
          onSuccess: () => void queryClient.invalidateQueries({ queryKey: lobbyQueryKey(code) }),
        },
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [signature, code, hostId, queryClient]);
}
