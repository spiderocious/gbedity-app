import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { logger } from '@lib/logger';

import { bootstrapEngine } from '../index';
import { roomRegistry } from '../room/room-registry';
import { RoomMemberRole, type RoomPlayer } from '../room/room.types';
import type { Audience, PlayerRef, ViewPatch } from '../types';
import { AudienceKind } from '../constants';
import type { OutputSink } from '../output-sink';
import { sessionManager } from '../session/session-manager';
import { ClientEvent, ServerEvent, actionSchema, joinSchema } from './protocol';
import { RateLimiter } from './rate-limiter';

// The real-time gateway (game-engine.md §7, PRD §14). PURE TRANSPORT: it bridges Socket.IO ↔
// rooms/sessions but owns no game lifecycle. It provides its OutputSink to the SessionManager and
// looks sessions up there — it does not hold the sessions map itself.
// - clients JOIN as host/player/display (with reconnect-into-seat for players),
// - ACTIONs are rate-limited then dispatched to the active session's runtime (via SessionManager),
// - an OutputSink fans projected views to the right sockets by audience.

interface SocketData {
  roomCode?: string;
  role?: RoomMemberRole;
  player?: PlayerRef;
}

// Socket.IO "rooms" used for fanout addressing within a game room.
const hostChannel = (code: string): string => `room:${code}:host`;
const displayChannel = (code: string): string => `room:${code}:display`;
const playerChannel = (code: string, playerId: string): string => `room:${code}:player:${playerId}`;

export const attachRoomGateway = (httpServer: HttpServer): Server => {
  bootstrapEngine();

  const io = new Server(httpServer, { cors: { origin: '*' } });
  const limiter = new RateLimiter();

  // Sink: route a projected view to the sockets matching the audience. Handed to the
  // SessionManager so every session (new or recovered) fans out through this transport.
  const sink: OutputSink = {
    send(roomCode: string, audience: Audience, patch: ViewPatch): void {
      io.to(channelFor(roomCode, audience)).emit(ServerEvent.VIEW, { audience: audience.kind, patch });
    },
  };
  sessionManager.setSink(sink);

  io.on('connection', (socket: Socket) => {
    socket.on(ClientEvent.JOIN, (raw: unknown) => {
      const parsed = joinSchema.safeParse(raw);
      if (!parsed.success) {
        socket.emit(ServerEvent.ERROR, { code: 'bad_join' });
        return;
      }
      handleJoin(socket, parsed.data.roomCode, parsed.data.role, parsed.data.reconnectToken, parsed.data.playerId);
    });

    socket.on(ClientEvent.ACTION, (raw: unknown) => {
      const data = socket.data as SocketData;
      const parsed = actionSchema.safeParse(raw);
      if (!parsed.success || !data.roomCode || !data.player) {
        socket.emit(ServerEvent.ERROR, { code: 'bad_action' });
        return;
      }
      if (!limiter.allow(data.player.id)) {
        socket.emit(ServerEvent.ERROR, { code: 'rate_limited' });
        return;
      }
      const session = sessions.get(data.roomCode);
      if (!session) {
        socket.emit(ServerEvent.ERROR, { code: 'no_active_game' });
        return;
      }
      try {
        session.runtime.dispatchAction(data.player, parsed.data.action);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ roomCode: data.roomCode, err: message }, 'action dispatch rejected');
        socket.emit(ServerEvent.ERROR, { code: 'invalid_action' });
      }
    });

    socket.on('disconnect', () => {
      const data = socket.data as SocketData;
      if (data.roomCode && data.player) {
        const room = roomRegistry.get(data.roomCode);
        const p = room?.players.find((rp) => rp.id === data.player?.id);
        if (p) p.connected = false;
      }
    });
  });

  const handleJoin = (
    socket: Socket,
    roomCode: string,
    role: RoomMemberRole,
    reconnectToken: string | undefined,
    playerId: string | undefined,
  ): void => {
    const room = roomRegistry.get(roomCode);
    if (!room) {
      socket.emit(ServerEvent.ERROR, { code: 'room_not_found' });
      return;
    }
    roomRegistry.touch(room);

    const data = socket.data as SocketData;
    data.roomCode = roomCode;
    data.role = role;

    if (role === RoomMemberRole.DISPLAY) {
      void socket.join(displayChannel(roomCode));
    } else if (role === RoomMemberRole.HOST) {
      void socket.join(hostChannel(roomCode));
      const host = room.players.find((p) => p.id === room.hostId);
      if (host) bindPlayer(socket, data, roomCode, host);
    } else {
      // PLAYER — reconnect into an existing seat by token, else they must have been added via HTTP.
      const seat = resolvePlayer(roomCode, reconnectToken, playerId);
      if (!seat) {
        socket.emit(ServerEvent.ERROR, { code: 'seat_not_found' });
        return;
      }
      bindPlayer(socket, data, roomCode, seat);
    }

    socket.emit(ServerEvent.JOINED, { roomCode, role });
  };

  const bindPlayer = (socket: Socket, data: SocketData, roomCode: string, seat: RoomPlayer): void => {
    data.player = { id: seat.id, nickname: seat.nickname };
    seat.connected = true;
    void socket.join(playerChannel(roomCode, seat.id));
  };

  const resolvePlayer = (
    roomCode: string,
    reconnectToken: string | undefined,
    playerId: string | undefined,
  ): RoomPlayer | undefined => {
    const room = roomRegistry.get(roomCode);
    if (!room) return undefined;
    if (reconnectToken !== undefined) {
      return room.players.find((p) => p.reconnectToken === reconnectToken);
    }
    if (playerId !== undefined) {
      return room.players.find((p) => p.id === playerId);
    }
    return undefined;
  };

  const channelFor = (roomCode: string, audience: Audience): string => {
    switch (audience.kind) {
      case AudienceKind.HOST:
        return hostChannel(roomCode);
      case AudienceKind.DISPLAY:
        return displayChannel(roomCode);
      case AudienceKind.PLAYER:
        return playerChannel(roomCode, audience.playerId);
      default: {
        const _never: never = audience;
        return _never;
      }
    }
  };

  // Expose the sink + session map so the HTTP edge (start-game) can create sessions.
  gatewayHandle = { sink, sessions };

  logger.info({}, 'room gateway attached');
  return io;
};

// A small handle the HTTP edge uses to start games against the live gateway. Set on attach.
export interface GatewayHandle {
  sink: OutputSink;
  sessions: Map<string, SingleSession>;
}
let gatewayHandle: GatewayHandle | null = null;

export const getGatewayHandle = (): GatewayHandle | null => gatewayHandle;
