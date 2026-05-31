import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { roomRegistry, type RoomRegistry } from '@engine/room/room-registry';
import { RoomPhase, type Room, type RoomPlayer } from '@engine/room/room.types';
import { getPlugin } from '@engine/registry';
import { getGatewayHandle, type GatewayHandle } from '@engine/gateway';
import { SingleSession } from '@engine/session/single-session';
import type { GameId } from '@engine/constants';
import type { PlayerRef } from '@engine/types';

// Room business logic. Returns ServiceResult — never throws for expected failures, never sees req.

export interface CreateRoomResult {
  code: string;
  hostId: string;
  hostToken: string;
}

export interface JoinRoomResult {
  code: string;
  playerId: string;
  reconnectToken: string;
}

export class RoomsService {
  constructor(private readonly registry: RoomRegistry = roomRegistry) {}

  createRoom(hostNickname: string): ServiceResult<CreateRoomResult> {
    const { room, host } = this.registry.create(hostNickname.trim());
    return ServiceSuccess({ code: room.code, hostId: host.id, hostToken: host.reconnectToken });
  }

  joinRoom(code: string, nickname: string): ServiceResult<JoinRoomResult> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    if (room.phase === RoomPhase.CLOSED) {
      return ServiceError(ERROR_CODES.ROOM_CLOSED, MESSAGE_KEYS.rooms.CLOSED, 409);
    }
    if (room.phase !== RoomPhase.LOBBY) {
      return ServiceError(ERROR_CODES.NOT_IN_LOBBY, MESSAGE_KEYS.rooms.CLOSED, 409);
    }
    if (this.registry.isFull(room)) {
      return ServiceError(ERROR_CODES.ROOM_FULL, MESSAGE_KEYS.rooms.FULL, 409);
    }
    if (this.registry.hasNickname(room, nickname)) {
      return ServiceError(ERROR_CODES.NICKNAME_TAKEN, MESSAGE_KEYS.rooms.NICKNAME_TAKEN, 409, {
        nickname: ['That nickname is taken.'],
      });
    }
    const player: RoomPlayer = this.registry.addPlayer(room, nickname.trim());
    return ServiceSuccess({ code: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
  }

  // Start a single game in a room. Host-only; room must be in lobby with enough players. Creates a
  // SingleSession bound to the live gateway's sink so views fan out over WebSocket. The gateway
  // handle is injectable so this is testable without a running socket server.
  startGame(
    code: string,
    hostId: string,
    gameId: string,
    config: unknown,
    content: unknown,
    handle: GatewayHandle | null = getGatewayHandle(),
  ): ServiceResult<{ code: string; gameId: GameId; instanceId: string }> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    if (room.hostId !== hostId) {
      return ServiceError(ERROR_CODES.NOT_HOST, MESSAGE_KEYS.games.NOT_HOST, 403);
    }
    if (room.phase !== RoomPhase.LOBBY) {
      return ServiceError(ERROR_CODES.GAME_ALREADY_RUNNING, MESSAGE_KEYS.games.ALREADY_RUNNING, 409);
    }

    const plugin = getPlugin(gameId);
    if (!plugin) {
      return ServiceError(ERROR_CODES.GAME_NOT_FOUND, MESSAGE_KEYS.games.NOT_FOUND, 404);
    }
    if (room.players.length < plugin.manifest.players.min) {
      return ServiceError(ERROR_CODES.NOT_ENOUGH_PLAYERS, MESSAGE_KEYS.games.NOT_ENOUGH_PLAYERS, 409);
    }
    if (handle === null) {
      return ServiceError(ERROR_CODES.GATEWAY_UNAVAILABLE, MESSAGE_KEYS.games.UNAVAILABLE, 503);
    }

    const players: PlayerRef[] = room.players.map((p) => ({ id: p.id, nickname: p.nickname }));
    const session = new SingleSession({
      roomCode: code,
      plugin,
      players,
      config,
      content,
      sink: handle.sink,
      onEnded: (): void => {
        // Return the room to lobby when the game ends (PRD §4).
        room.phase = RoomPhase.LOBBY;
        room.activeGame = null;
        handle.sessions.delete(code);
      },
    });
    handle.sessions.set(code, session);

    const resolvedId = plugin.manifest.id; // the validated, typed GameId
    room.phase = RoomPhase.IN_GAME;
    room.activeGame = { instanceId: session.runtime.instanceId, gameId: resolvedId };
    this.registry.touch(room);

    return ServiceSuccess({ code, gameId: resolvedId, instanceId: session.runtime.instanceId });
  }

  // A lobby snapshot for the host dashboard (no PII beyond chosen nicknames, PRD §12).
  lobby(code: string): ServiceResult<{ code: string; phase: Room['phase']; players: { id: string; nickname: string }[] }> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    return ServiceSuccess({
      code: room.code,
      phase: room.phase,
      players: room.players.map((p) => ({ id: p.id, nickname: p.nickname })),
    });
  }
}

export const roomsService = new RoomsService();
