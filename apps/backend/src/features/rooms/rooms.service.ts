import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { roomRegistry, type RoomRegistry } from '@engine/room/room-registry';
import { RoomPhase, type Room, type RoomPlayer } from '@engine/room/room.types';

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
