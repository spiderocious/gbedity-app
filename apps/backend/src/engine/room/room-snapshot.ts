import { getRedis } from '@lib/redis';
import { logger } from '@lib/logger';

import type { Room } from './room.types';

// Persist the Room itself to Redis so it survives a restart (PRD §12). The game-state snapshot
// (../snapshot.ts) restores the active game; this restores the room that owns it. Both are needed:
// a recovered game with no room to attach to is useless. Best-effort — single-instance still works
// if Redis is down (PRD §11).

const roomKey = (code: string): string => `gbedity:room:${code}`;
const ACTIVE_ROOMS = 'gbedity:room:active';
const ROOM_TTL_SECONDS = 60 * 60; // past the 30-min idle teardown

export const writeRoomSnapshot = async (room: Room): Promise<void> => {
  try {
    await getRedis()
      .multi()
      .set(roomKey(room.code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS)
      .sadd(ACTIVE_ROOMS, room.code)
      .exec();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ code: room.code, err: message }, 'room snapshot write failed');
  }
};

export const readRoomSnapshot = async (code: string): Promise<Room | null> => {
  try {
    const raw = await getRedis().get(roomKey(code));
    if (raw === null) return null;
    return JSON.parse(raw) as Room;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ code, err: message }, 'room snapshot read failed');
    return null;
  }
};

export const listActiveRooms = async (): Promise<string[]> => {
  try {
    return await getRedis().smembers(ACTIVE_ROOMS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, 'active room list read failed');
    return [];
  }
};

export const deleteRoomSnapshot = async (code: string): Promise<void> => {
  try {
    await getRedis().multi().del(roomKey(code)).srem(ACTIVE_ROOMS, code).exec();
  } catch {
    // non-fatal
  }
};
