import { z } from 'zod';

import { RoomMemberRole } from '../room/room.types';

// The WS protocol (game-engine.md §7). Client→server and server→client message names are named
// constants (§0.5). Payloads are Zod-validated at the boundary.

export const ClientEvent = {
  JOIN: 'client.join', // join a room as host/player/display
  ACTION: 'client.action', // a game action for the active game
} as const;
export type ClientEvent = (typeof ClientEvent)[keyof typeof ClientEvent];

export const ServerEvent = {
  JOINED: 'server.joined',
  VIEW: 'server.view', // a projected view patch
  ERROR: 'server.error',
} as const;
export type ServerEvent = (typeof ServerEvent)[keyof typeof ServerEvent];

// JOIN: a participant identifies its room, role, and (for reconnect) its token.
export const joinSchema = z.object({
  roomCode: z.string().length(6),
  role: z.nativeEnum(RoomMemberRole),
  // players send a reconnectToken to re-enter their seat; display/host may omit.
  reconnectToken: z.string().optional(),
  playerId: z.string().optional(),
});
export type JoinPayload = z.infer<typeof joinSchema>;

// ACTION: an opaque game action — the plugin's actionSchema validates the inner shape.
export const actionSchema = z.object({
  action: z.unknown(),
});
export type ActionPayload = z.infer<typeof actionSchema>;
