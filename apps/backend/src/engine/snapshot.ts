import { getRedis } from '@lib/redis';
import { logger } from '@lib/logger';
import type { EpochMs } from '@shared/time';

import type { GameId } from './constants';

// Runtime snapshot of a live game instance (game-engine.md §6). State is plain JSON; timers carry
// absolute deadlines so they can be re-armed on recovery; pendingRefs track in-flight async
// service requests so a verdict arriving after restart still routes (§5).

export interface TimerSnapshot {
  key: string;
  fireAt: EpochMs;
}

export interface GameSnapshot {
  roomCode: string;
  instanceId: string;
  gameId: GameId;
  state: unknown; // the plugin's JSON-serializable State
  timers: TimerSnapshot[];
  pendingRefs: string[];
  snapshotAt: EpochMs;
}

const SNAPSHOT_TTL_SECONDS = 60 * 60; // an hour is plenty past the 30-min idle teardown
const key = (roomCode: string): string => `gbedity:snapshot:${roomCode}`;

// Best-effort write — if Redis is down we log and continue (single-instance still works, PRD §11).
export const writeSnapshot = async (snapshot: GameSnapshot): Promise<void> => {
  try {
    await getRedis().set(key(snapshot.roomCode), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SECONDS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ roomCode: snapshot.roomCode, err: message }, 'snapshot write failed');
  }
};

export const readSnapshot = async (roomCode: string): Promise<GameSnapshot | null> => {
  try {
    const raw = await getRedis().get(key(roomCode));
    if (raw === null) return null;
    return JSON.parse(raw) as GameSnapshot;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ roomCode, err: message }, 'snapshot read failed');
    return null;
  }
};

export const deleteSnapshot = async (roomCode: string): Promise<void> => {
  try {
    await getRedis().del(key(roomCode));
  } catch {
    // non-fatal
  }
};
