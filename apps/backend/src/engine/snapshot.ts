import { getRedis } from '@lib/redis';
import { logger } from '@lib/logger';
import type { EpochMs } from '@shared/time';

import type { GameId } from './constants';
import type { PlayerRef } from './types';

// Runtime snapshot of a live game instance (game-engine.md §6). State is plain JSON; timers carry
// absolute deadlines so they can be re-armed on recovery; pendingRefs track in-flight async
// service requests so a verdict arriving after restart still routes (§5).
//
// The snapshot is SELF-SUFFICIENT: it carries everything needed to RECONSTRUCT a runtime on a
// cold boot (gameId → plugin, seed → identical PRNG, players → view/scoring roster), not merely
// to refill a runtime that already exists. Recovery rebuilds the runtime from this, then rehydrates.

export interface TimerSnapshot {
  key: string;
  fireAt: EpochMs;
}

export interface GameSnapshot {
  roomCode: string;
  instanceId: string;
  gameId: GameId;
  seed: string; // so the rebuilt runtime's PRNG matches the original (§6 determinism)
  players: PlayerRef[]; // the roster view()/scoreRound iterate over
  state: unknown; // the plugin's JSON-serializable State
  timers: TimerSnapshot[];
  pendingRefs: string[];
  snapshotAt: EpochMs;
}

const SNAPSHOT_TTL_SECONDS = 60 * 60; // an hour is plenty past the 30-min idle teardown
const snapshotKey = (roomCode: string): string => `gbedity:snapshot:${roomCode}`;
// A Redis set of room codes that currently have a snapshot — lets recovery enumerate without a
// KEYS scan (KEYS is O(n) and unsafe in production; a set membership is the proper pattern).
const ACTIVE_SET = 'gbedity:snapshot:active';

// Best-effort write — if Redis is down we log and continue (single-instance still works, PRD §11).
export const writeSnapshot = async (snapshot: GameSnapshot): Promise<void> => {
  try {
    const redis = getRedis();
    await redis
      .multi()
      .set(snapshotKey(snapshot.roomCode), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SECONDS)
      .sadd(ACTIVE_SET, snapshot.roomCode)
      .exec();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ roomCode: snapshot.roomCode, err: message }, 'snapshot write failed');
  }
};

export const readSnapshot = async (roomCode: string): Promise<GameSnapshot | null> => {
  try {
    const raw = await getRedis().get(snapshotKey(roomCode));
    if (raw === null) return null;
    return JSON.parse(raw) as GameSnapshot;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ roomCode, err: message }, 'snapshot read failed');
    return null;
  }
};

// Room codes with a live snapshot (for the boot-time recovery pass).
export const listActiveSnapshots = async (): Promise<string[]> => {
  try {
    return await getRedis().smembers(ACTIVE_SET);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, 'active snapshot list read failed');
    return [];
  }
};

export const deleteSnapshot = async (roomCode: string): Promise<void> => {
  try {
    await getRedis().multi().del(snapshotKey(roomCode)).srem(ACTIVE_SET, roomCode).exec();
  } catch {
    // non-fatal
  }
};
