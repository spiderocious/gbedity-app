import { getDb } from '@db/client';
import type { EpochMs } from '@shared/time';

// Persistence for game-play history (PRD §9, doc §9.2). Game-AGNOSTIC: a summary record per played
// game + the size-not-contents session-event stream. No per-game content is stored.

export interface GamePlayRecord {
  id: string; // gi_<ULID> (game instance id)
  roomCode: string;
  gameId: string;
  players: { id: string; nickname: string }[];
  finalBoard: { playerId: string; points: number }[];
  startedAt: EpochMs;
  endedAt: EpochMs;
  createdAt: EpochMs;
}

export interface SessionEventRecord {
  instanceId: string;
  roomCode: string;
  seq: number;
  at: EpochMs;
  type: string;
  data: Record<string, unknown>;
}

const COLLECTION = { GAME_PLAYS: 'game_plays', SESSION_EVENTS: 'session_events' } as const;

export const gamePlaysRepository = {
  async ensureIndexes(): Promise<void> {
    await getDb().collection(COLLECTION.GAME_PLAYS).createIndex({ createdAt: -1 });
    await getDb().collection(COLLECTION.GAME_PLAYS).createIndex({ id: 1 }, { unique: true });
    await getDb().collection(COLLECTION.GAME_PLAYS).createIndex({ gameId: 1, createdAt: -1 });
    await getDb().collection(COLLECTION.SESSION_EVENTS).createIndex({ instanceId: 1, seq: 1 });
  },

  async insertPlay(record: GamePlayRecord): Promise<void> {
    await getDb().collection(COLLECTION.GAME_PLAYS).insertOne(record);
  },

  async insertEvent(record: SessionEventRecord): Promise<void> {
    await getDb().collection(COLLECTION.SESSION_EVENTS).insertOne(record);
  },

  // Cursor-paginated, newest first. `before` is the last seen createdAt.
  async listPlays(opts: { limit: number; before?: EpochMs; gameId?: string }): Promise<GamePlayRecord[]> {
    const filter: Record<string, unknown> = {};
    if (opts.before !== undefined) filter.createdAt = { $lt: opts.before };
    if (opts.gameId !== undefined) filter.gameId = opts.gameId;
    return getDb()
      .collection<GamePlayRecord>(COLLECTION.GAME_PLAYS)
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(opts.limit)
      .toArray();
  },

  async getPlay(id: string): Promise<GamePlayRecord | null> {
    return getDb().collection<GamePlayRecord>(COLLECTION.GAME_PLAYS).findOne({ id }, { projection: { _id: 0 } });
  },

  async listEvents(instanceId: string): Promise<SessionEventRecord[]> {
    return getDb()
      .collection<SessionEventRecord>(COLLECTION.SESSION_EVENTS)
      .find({ instanceId }, { projection: { _id: 0 } })
      .sort({ seq: 1 })
      .toArray();
  },

  // Aggregate metrics per game (admin 2.5).
  async metricsByGame(): Promise<{ gameId: string; plays: number; avgPlayers: number; avgDurationMs: number }[]> {
    const rows = await getDb()
      .collection<GamePlayRecord>(COLLECTION.GAME_PLAYS)
      .aggregate([
        {
          $group: {
            _id: '$gameId',
            plays: { $sum: 1 },
            avgPlayers: { $avg: { $size: '$players' } },
            avgDurationMs: { $avg: { $subtract: ['$endedAt', '$startedAt'] } },
          },
        },
        { $sort: { plays: -1 } },
      ])
      .toArray();
    return rows.map((r) => ({
      gameId: String(r._id),
      plays: Number(r.plays),
      avgPlayers: Math.round(Number(r.avgPlayers) * 10) / 10,
      avgDurationMs: Math.round(Number(r.avgDurationMs)),
    }));
  },
};
