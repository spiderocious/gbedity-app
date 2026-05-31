import { io, type Socket } from 'socket.io-client';

import { ENV } from '../config/env.ts';

// Socket.IO client wrapper for the live-play protocol (api-docs §WebSocket). One connection
// per client; the realtime provider owns its lifecycle. Typed client→server emits; server→
// client events are subscribed via on().

export const ClientEvent = {
  JOIN: 'client.join',
  ACTION: 'client.action',
} as const;

export const ServerEvent = {
  JOINED: 'server.joined',
  VIEW: 'server.view',
  ERROR: 'server.error',
  ROOM_SUSPENDED: 'server.room_suspended',
  ROOM_ENDED: 'server.room_ended',
  RESUMED: 'server.resumed',
} as const;

export const SocketRole = {
  HOST: 'host',
  PLAYER: 'player',
  DISPLAY: 'display',
} as const;
export type SocketRole = (typeof SocketRole)[keyof typeof SocketRole];

export interface JoinPayload {
  readonly roomCode: string;
  readonly role: SocketRole;
  readonly reconnectToken?: string;
  readonly playerId?: string;
}

export function createSocket(): Socket {
  // websocket transport only — matches the backend; avoids long-poll churn on flaky nets.
  return io(ENV.WS_URL, { transports: ['websocket'], autoConnect: true });
}
