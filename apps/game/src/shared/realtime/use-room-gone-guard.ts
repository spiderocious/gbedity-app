import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { DrawerService } from '@gbedity/ui';

import { ROUTES } from '../constants/routes.ts';
import { log } from '../observability/logger.ts';
import { LogEvent } from '../observability/events.ts';
import { ApiError, ApiErrorCode } from '../services/api-error.ts';
import { sessionStore } from '../services/session-store.ts';

// Watches a room/lobby query for a "room is gone" error (room_not_found / 404) and surfaces it
// LOUDLY — no silent failures. The room poll is the canary: if it 404s, the room was closed/swept.
//
//  - Player: a blocking "Reconnecting…" modal that auto-retries the query up to RECONNECT_TRIES
//    times; if the room is still gone, "This room no longer exists" with a Leave action.
//  - Host: "This room was closed" with a "Re-open room" action (creates a fresh room and routes to
//    its lobby) — the practical "restore" for a v1 with no server-side room resurrection.
//
// Only ONE modal at a time (guarded), and it dismisses itself the moment the query recovers.

const RECONNECT_TRIES = 3;

interface GuardQuery {
  readonly error: unknown;
  readonly isError: boolean;
  readonly refetch: () => Promise<unknown>;
  /**
   * React Query bumps this timestamp on EVERY failed fetch (including manual refetches), even when
   * the error stays the same. The guard depends on it so a failed "Reconnect now" re-surfaces the
   * modal for the next attempt — `isError` alone never re-fires (it stays true across retries).
   */
  readonly errorUpdatedAt: number;
}

const isRoomGone = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.code === ApiErrorCode.ROOM_NOT_FOUND || error.code === ApiErrorCode.NOT_FOUND || error.status === 404);

export function useRoomGoneGuard(query: GuardQuery, opts: { readonly code: string; readonly role: 'host' | 'player' }): void {
  const navigate = useNavigate();
  const openRef = useRef(false); // a modal is currently shown (don't stack)
  const triesRef = useRef(0);

  const gone = query.isError && isRoomGone(query.error);

  useEffect(() => {
    // Recovered → close any open modal and reset the counter.
    if (!gone) {
      if (openRef.current) {
        DrawerService.closeModal();
        openRef.current = false;
      }
      triesRef.current = 0;
      return;
    }
    if (openRef.current) return; // already showing a modal for this outage

    log.event(LogEvent.ROOM_GONE_DETECTED, { code: opts.code, role: opts.role, tries: triesRef.current, errorUpdatedAt: query.errorUpdatedAt }, { component: 'useRoomGoneGuard' });

    if (opts.role === 'player') {
      showPlayerModal();
    } else {
      showHostModal();
    }

    function showPlayerModal(): void {
      openRef.current = true;
      if (triesRef.current < RECONNECT_TRIES) {
        triesRef.current += 1;
        DrawerService.confirm('Room disconnected', {
          description: `Trying to reconnect… (attempt ${triesRef.current} of ${RECONNECT_TRIES})`,
          confirmLabel: 'Reconnect now',
          cancelLabel: 'Leave',
          sticky: true, // can't dismiss by scrim/escape — it's a hard state
          onConfirm: () => {
            log.event(LogEvent.ROOM_GONE_RECONNECT_CLICK, { code: opts.code, attempt: triesRef.current }, { component: 'useRoomGoneGuard' });
            openRef.current = false;
            void query.refetch();
          },
          onCancel: () => {
            openRef.current = false;
            navigate(ROUTES.LANDING);
          },
        });
      } else {
        DrawerService.confirm('This room no longer exists', {
          description: 'The host closed the room or it timed out. Ask for a new code to play again.',
          confirmLabel: 'Back to home',
          sticky: true,
          onConfirm: () => {
            openRef.current = false;
            sessionStore.clearRoom();
            navigate(ROUTES.LANDING);
          },
        });
      }
    }

    function showHostModal(): void {
      openRef.current = true;
      DrawerService.confirm('This room was closed', {
        description: 'The room is no longer active. Re-open a fresh room to keep going, or head home.',
        confirmLabel: 'Re-open room',
        cancelLabel: 'Back to home',
        sticky: true,
        onConfirm: () => {
          openRef.current = false;
          sessionStore.clearRoom();
          // Practical "restore": start a new room from the host flow (server has no resurrection).
          navigate(ROUTES.HOST_NEW);
        },
        onCancel: () => {
          openRef.current = false;
          sessionStore.clearRoom();
          navigate(ROUTES.LANDING);
        },
      });
    }
    // `gone` is the primary trigger; `errorUpdatedAt` re-fires the effect on each NEW failed refetch
    // (so a failed "Reconnect now" surfaces attempt 2/3, etc.) since `gone` stays true across retries.
    // (No react-hooks/exhaustive-deps in this project's eslint.)
  }, [gone, query.errorUpdatedAt]);
}
