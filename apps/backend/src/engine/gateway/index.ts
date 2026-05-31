import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { logger } from '@lib/logger';

import { bootstrapEngine } from '../index';
import { roomRegistry } from '../room/room-registry';
import { HOST_LEAVE_GRACE_MS, RoomMemberRole, RoomPhase, type RoomPlayer } from '../room/room.types';
import type { Audience, PlayerRef, ViewPatch } from '../types';
import { ActorRole, AudienceKind } from '../constants';
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

  // Host-leave grace timers, keyed by room code (PRD §10). Set when the host disconnects; cleared
  // if the host returns within the grace window; on expiry the room ends.
  const suspensionTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
      const runtime = sessionManager.activeRuntime(data.roomCode);
      if (!runtime) {
        socket.emit(ServerEvent.ERROR, { code: 'no_active_game' });
        return;
      }
      try {
        // The host role is token-verified at join (handleJoin), so this is trustworthy for
        // gating host-only actions. Everyone else is PLAYER.
        const actorRole = data.role === RoomMemberRole.HOST ? ActorRole.HOST : ActorRole.PLAYER;
        runtime.dispatchAction(data.player, actorRole, parsed.data.action);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ roomCode: data.roomCode, err: message }, 'action dispatch rejected');
        socket.emit(ServerEvent.ERROR, { code: 'invalid_action' });
      }
    });

    socket.on('disconnect', () => {
      const data = socket.data as SocketData;
      if (data.player) limiter.reset(data.player.id); // evict the player's rate bucket (P2)
      if (data.roomCode && data.player) {
        const room = roomRegistry.get(data.roomCode);
        const p = room?.players.find((rp) => rp.id === data.player?.id);
        if (p) p.connected = false;
        // Host left → start the grace countdown (PRD §10).
        if (room && data.role === RoomMemberRole.HOST && room.phase !== RoomPhase.CLOSED) {
          suspendRoom(data.roomCode);
        }
      }
    });
  });

  // Host disconnected: suspend the room and arm a grace timer. If the host doesn't return within
  // HOST_LEAVE_GRACE_MS, end the room (PRD §10).
  const suspendRoom = (code: string): void => {
    const room = roomRegistry.get(code);
    if (!room || suspensionTimers.has(code)) return;
    room.phase = RoomPhase.SUSPENDED;
    roomRegistry.touch(room);
    io.to(displayChannel(code)).emit(ServerEvent.ROOM_SUSPENDED, { roomCode: code });
    const timer = setTimeout(() => {
      suspensionTimers.delete(code);
      void endRoom(code);
    }, HOST_LEAVE_GRACE_MS);
    suspensionTimers.set(code, timer);
    logger.info({ code }, 'room suspended — host left');
  };

  // Host returned within the grace window: cancel the countdown and resume.
  const resumeRoom = (code: string): void => {
    const timer = suspensionTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      suspensionTimers.delete(code);
    }
    const room = roomRegistry.get(code);
    if (room && room.phase === RoomPhase.SUSPENDED) {
      // Resume to whatever it was doing: in a game if one is active, else lobby.
      room.phase = sessionManager.has(code) ? RoomPhase.IN_GAME : RoomPhase.LOBBY;
      roomRegistry.touch(room);
      logger.info({ code }, 'room resumed — host returned');
    }
  };

  // End a room: notify, dispose any session, close the room (clears snapshots).
  const endRoom = async (code: string): Promise<void> => {
    io.to(displayChannel(code)).emit(ServerEvent.ROOM_ENDED, { roomCode: code });
    await sessionManager.end(code);
    roomRegistry.close(code);
    logger.info({ code }, 'room ended');
  };

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
      // Host must prove identity with the hostToken issued at room creation — `role:'host'` is
      // otherwise client-asserted and any client knowing the code could bind as host (BUG-05).
      const host = room.players.find((p) => p.id === room.hostId);
      if (!host || reconnectToken === undefined || host.reconnectToken !== reconnectToken) {
        socket.emit(ServerEvent.ERROR, { code: 'host_auth_failed' });
        return;
      }
      void socket.join(hostChannel(roomCode));
      bindPlayer(socket, data, roomCode, host);
      resumeRoom(roomCode); // host returned — cancel any grace countdown (PRD §10)
    } else {
      // PLAYER — reconnect into an existing seat by token, else they must have been added via HTTP.
      const seat = resolvePlayer(roomCode, reconnectToken, playerId);
      if (!seat) {
        socket.emit(ServerEvent.ERROR, { code: 'seat_not_found' });
        return;
      }
      bindPlayer(socket, data, roomCode, seat);
      // If a game is live, re-project current state to this seat and signal resumed (PRD §10/§12).
      const runtime = sessionManager.activeRuntime(roomCode);
      if (runtime) {
        runtime.resendTo(seat.id);
        socket.emit(ServerEvent.RESUMED, { roomCode });
      }
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

  // Periodic maintenance (PRD §4): reap idle rooms — ending their sessions and clearing any
  // lingering suspension timer — and evict stale rate-limiter buckets. setInterval is unref'd so
  // it never keeps the process alive on its own.
  const sweeper = setInterval(() => {
    for (const code of roomRegistry.sweepIdle()) {
      const timer = suspensionTimers.get(code);
      if (timer) {
        clearTimeout(timer);
        suspensionTimers.delete(code);
      }
      void sessionManager.end(code);
    }
    limiter.sweepStale();
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();
  io.on('close', () => clearInterval(sweeper));

  logger.info({}, 'room gateway attached');
  return io;
};

const SWEEP_INTERVAL_MS = 60 * 1000; // reap idle rooms once a minute
