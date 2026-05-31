import { createContext, useContext } from 'react';

import type { ViewPatch } from '../types/view.ts';

// What in-game screens read: the latest view patch for this client's audience, the
// connection status, any lifecycle signal, and a way to send actions.

export const ConnectionStatus = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  SUSPENDED: 'suspended',
  ENDED: 'ended',
  ERROR: 'error',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export interface RoomSocketValue {
  readonly status: ConnectionStatus;
  /** Latest projected view patch for this client's audience (null until first view). */
  readonly patch: ViewPatch | null;
  /** Last server.error code, if any. */
  readonly errorCode: string | null;
  /** Send a game action ({ type, ... }). */
  readonly sendAction: (action: Record<string, unknown>) => void;
}

export const RoomSocketContext = createContext<RoomSocketValue | null>(null);

export function useRoomSocket(): RoomSocketValue {
  const ctx = useContext(RoomSocketContext);
  if (ctx === null) {
    throw new Error('useRoomSocket must be used within a RoomSocketProvider');
  }
  return ctx;
}
