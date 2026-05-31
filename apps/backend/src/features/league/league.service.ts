import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { roomRegistry, type RoomRegistry } from '@engine/room/room-registry';
import { RoomPhase } from '@engine/room/room.types';
import { getPlugin } from '@engine/registry';
import { getContentResolver } from '@engine/content-resolver';
import { sessionManager, type SessionManager } from '@engine/session/session-manager';
import { AggregateMode, type LeagueConfig, type LeagueEntry } from '@engine/session/session.types';
import { DEFAULT_RATING_FILTER, type RatingFilter } from '@features/content/content.constants';
import type { PlayerRef } from '@engine/types';

// League HTTP surface (4.1/4.2). Host queues {gameId, config, weight}; the service resolves each
// game's plugin + server-side content (rating-filtered), validates config, builds a LeagueConfig,
// and starts the league via the SessionManager. The engine handles percent-of-max + aggregation.

export interface QueueEntryInput {
  gameId: string;
  config?: unknown;
  weight?: number;
}

const AGGREGATE_BY_NAME: Record<string, (typeof AggregateMode)[keyof typeof AggregateMode]> = {
  sum: AggregateMode.SUM,
  average: AggregateMode.AVERAGE,
  top_3: AggregateMode.TOP_3,
};

export class LeagueService {
  constructor(
    private readonly registry: RoomRegistry = roomRegistry,
    private readonly sessions: SessionManager = sessionManager,
  ) {}

  async startLeague(
    code: string,
    hostId: string,
    queue: QueueEntryInput[],
    aggregate: string,
    ratingFilter: RatingFilter = DEFAULT_RATING_FILTER,
  ): Promise<ServiceResult<{ code: string; games: number }>> {
    const room = this.registry.get(code);
    if (!room) return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    if (room.hostId !== hostId) return ServiceError(ERROR_CODES.NOT_HOST, MESSAGE_KEYS.games.NOT_HOST, 403);
    if (room.phase !== RoomPhase.LOBBY) {
      return ServiceError(ERROR_CODES.GAME_ALREADY_RUNNING, MESSAGE_KEYS.games.ALREADY_RUNNING, 409);
    }
    if (queue.length === 0) {
      return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, {
        queue: ['At least one game required.'],
      });
    }

    const entries: LeagueEntry[] = [];
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i]!;
      const plugin = getPlugin(item.gameId);
      if (!plugin) return ServiceError(ERROR_CODES.GAME_NOT_FOUND, MESSAGE_KEYS.games.NOT_FOUND, 404);
      if (room.players.length < plugin.manifest.players.min) {
        return ServiceError(ERROR_CODES.NOT_ENOUGH_PLAYERS, MESSAGE_KEYS.games.NOT_ENOUGH_PLAYERS, 409);
      }
      const configCheck = plugin.configSchema.safeParse(item.config ?? {});
      if (!configCheck.success) {
        return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, {
          [`queue.${i}.config`]: ['Invalid config.'],
        });
      }
      const resolver = getContentResolver(item.gameId);
      const seed = `${code}:league:${i}:${item.gameId}`;
      const content = resolver ? await resolver({ config: configCheck.data, ratingFilter, seed }) : {};
      const contentCheck = plugin.contentSchema.safeParse(content);
      if (!contentCheck.success) {
        return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, {
          [`queue.${i}.content`]: ['Could not resolve content.'],
        });
      }
      // Reject an explicit invalid weight rather than silently coercing (BUG-E). Absent = 1.
      if (item.weight !== undefined && item.weight !== 1 && item.weight !== 2 && item.weight !== 3) {
        return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, {
          [`queue.${i}.weight`]: ['Weight must be 1, 2, or 3.'],
        });
      }
      entries.push({
        plugin,
        config: configCheck.data,
        content: contentCheck.data,
        weight: item.weight ?? 1,
      });
    }

    const league: LeagueConfig = { entries, aggregate: AGGREGATE_BY_NAME[aggregate] ?? AggregateMode.SUM };
    const players: PlayerRef[] = room.players.map((p) => ({ id: p.id, nickname: p.nickname }));
    this.sessions.startLeague({
      roomCode: code,
      players,
      league,
      onEnded: (): void => {
        room.phase = RoomPhase.LOBBY;
        room.activeGame = null;
        void this.sessions.end(code);
      },
    });
    room.phase = RoomPhase.IN_GAME;
    this.registry.touch(room);
    return ServiceSuccess({ code, games: entries.length });
  }

  // Cross-game standings for a running/finished league.
  standings(code: string): ServiceResult<{ standings: { playerId: string; score: number }[] }> {
    const league = this.sessions.league(code);
    if (!league) return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.common.NOT_FOUND, 404);
    return ServiceSuccess({ standings: league.aggregate() });
  }
}

export const leagueService = new LeagueService();
