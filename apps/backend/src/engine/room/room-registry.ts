import { ulid } from 'ulid';

import { ID_PREFIX, newId, newRoomCode } from '@shared/ids';
import { logger } from '@lib/logger';
import { now } from '@shared/time';

import {
  ROOM_IDLE_MS,
  ROOM_SOFT_CAP,
  RoomPhase,
  type Room,
  type RoomPlayer,
} from './room.types';

// The in-memory source of truth for live rooms. Single-instance for v1 (PRD §11); Redis snapshots
// (see snapshot.ts) provide restart recovery, not a second authority.

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  // Create a room with the given host nickname. Returns the room + the host player record.
  create(hostNickname: string): { room: Room; host: RoomPlayer } {
    const code = this.uniqueCode();
    const at = now();
    const host: RoomPlayer = {
      id: newId(ID_PREFIX.PLAYER),
      nickname: hostNickname,
      reconnectToken: ulid(),
      connected: false,
      joinedAt: at,
    };
    const room: Room = {
      code,
      hostId: host.id,
      phase: RoomPhase.LOBBY,
      players: [host],
      activeGame: null,
      createdAt: at,
      lastActivityAt: at,
    };
    this.rooms.set(code, room);
    logger.info({ code }, 'room created');
    return { room, host };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  // Add a player to the lobby. Caller is responsible for phase/duplicate-nickname checks at the
  // service layer; this enforces only the structural soft cap.
  addPlayer(room: Room, nickname: string): RoomPlayer {
    const player: RoomPlayer = {
      id: newId(ID_PREFIX.PLAYER),
      nickname,
      reconnectToken: ulid(),
      connected: false,
      joinedAt: now(),
    };
    room.players.push(player);
    this.touch(room);
    return player;
  }

  isFull(room: Room): boolean {
    return room.players.length >= ROOM_SOFT_CAP;
  }

  hasNickname(room: Room, nickname: string): boolean {
    const wanted = nickname.trim().toLowerCase();
    return room.players.some((p) => p.nickname.trim().toLowerCase() === wanted);
  }

  touch(room: Room): void {
    room.lastActivityAt = now();
  }

  close(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.phase = RoomPhase.CLOSED;
      this.rooms.delete(code);
      logger.info({ code }, 'room closed');
    }
  }

  // Tear down rooms idle past the threshold (PRD §4). Returns the codes removed.
  sweepIdle(): string[] {
    const cutoff = now() - ROOM_IDLE_MS;
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.lastActivityAt < cutoff) {
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    if (removed.length > 0) logger.info({ count: removed.length }, 'idle rooms swept');
    return removed;
  }

  count(): number {
    return this.rooms.size;
  }

  private uniqueCode(): string {
    // Collision-safe: regenerate on the rare clash.
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    return code;
  }
}

// Process-wide singleton registry.
export const roomRegistry = new RoomRegistry();
