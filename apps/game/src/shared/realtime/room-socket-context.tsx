import { createContext, useContext } from 'react';

import type { Audience } from '../types/view.ts';
import type { ViewPatch } from '../types/view.ts';

// What in-game screens read: the latest view patch(es), keyed by audience so a surface picks
// the projection it needs. The backend sends a separate view per audience and the HOST seat
// receives BOTH host- and player-audience patches (F-3); keeping a per-audience map (not just
// "the latest patch") is what stops the host surface flip-flopping between projections.

export const ConnectionStatus = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  SUSPENDED: 'suspended',
  ENDED: 'ended',
  ERROR: 'error',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export type PatchesByAudience = Partial<Record<Audience, ViewPatch>>;

export interface RoomSocketValue {
  readonly status: ConnectionStatus;
  /** Latest patch per audience. The host seat fills `player` (play) and `host` (host chrome);
   *  player/display fill only their own. */
  readonly patches: PatchesByAudience;
  /** Convenience: the patch this client should render — player projection if present (host or
   *  player seat both play off it), else display, else host. Null until the first view. */
  readonly patch: ViewPatch | null;
  /** Last server.error code, if any. */
  readonly errorCode: string | null;
  /** Send a game action ({ type, ... }). */
  readonly sendAction: (action: Record<string, unknown>) => void;
  /** Host-only: end the session for everyone (server boots all clients to the closed screen). */
  readonly endSession: () => void;
}

export const RoomSocketContext = createContext<RoomSocketValue | null>(null);

export function useRoomSocket(): RoomSocketValue {
  const ctx = useContext(RoomSocketContext);
  if (ctx === null) {
    throw new Error('useRoomSocket must be used within a RoomSocketProvider');
  }
  return ctx;
}
