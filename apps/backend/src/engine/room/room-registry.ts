import { ulid } from 'ulid';

import { ID_PREFIX, newId, newRoomCode } from '@shared/ids';
import { logger } from '@lib/logger';
import { now } from '@shared/time';

import {
  ROOM_IDLE_MS,
  ROOM_SOFT_CAP,
  RoomPhase,
  type LobbyLineupEntry,
  type Room,
  type RoomPlayer,
} from './room.types';
import { deleteRoomSnapshot, writeRoomSnapshot } from './room-snapshot';

// The in-memory source of truth for live rooms. Single-instance for v1 (PRD §11); Redis snapshots
// (see room-snapshot.ts) provide restart recovery, not a second authority. The registry
// write-throughs to Redis on every mutation so a restart can rebuild rooms via restore().

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  // Fire-and-forget Redis write-through. Best-effort; never blocks the synchronous room API.
  private persist(room: Room): void {
    void writeRoomSnapshot(room);
  }

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
      lobbyLineup: [],
      createdAt: at,
      lastActivityAt: at,
    };
    this.rooms.set(code, room);
    this.persist(room);
    logger.info({ code }, 'room created');
    return { room, host };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  // Re-insert a room rebuilt from a Redis snapshot on boot (recovery). Does not re-persist —
  // the snapshot it came from is already the source. Defaults lobbyLineup for rooms snapshotted
  // before this field existed (forward-compat on recovery).
  restore(room: Room): void {
    if (room.lobbyLineup === undefined) room.lobbyLineup = [];
    this.rooms.set(room.code, room);
  }

  // Replace the host's published lineup (host-only/phase checks live at the service layer). The
  // entries are already validated + bounded by the service before this is called. Write-through
  // to Redis so it survives a restart.
  setLineup(room: Room, lineup: LobbyLineupEntry[]): void {
    room.lobbyLineup = lineup;
    this.touch(room);
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

  // Bump activity and write-through to Redis. Called after every room mutation.
  touch(room: Room): void {
    room.lastActivityAt = now();
    this.persist(room);
  }

  close(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.phase = RoomPhase.CLOSED;
      this.rooms.delete(code);
      void deleteRoomSnapshot(code);
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
        void deleteRoomSnapshot(code);
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
