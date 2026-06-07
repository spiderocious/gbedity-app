import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { zodFieldErrors } from '@shared/http/zod-errors';
import { MESSAGE_KEYS } from '@shared/messages';
import { roomRegistry, type RoomRegistry } from '@engine/room/room-registry';
import {
  RoomPhase,
  type LobbyLineupEntry,
  type Room,
  type RoomPlayer,
} from '@engine/room/room.types';
import { getPlugin } from '@engine/registry';
import { toLineupEntries, type LineupInput } from './lineup';
import { getContentResolver } from '@engine/content-resolver';
import { sessionManager, type SessionManager } from '@engine/session/session-manager';
import type { GameId } from '@engine/constants';
import type { PlayerRef } from '@engine/types';
import { DEFAULT_RATING_FILTER, type RatingFilter } from '@features/content/content.constants';

// Room business logic. Returns ServiceResult — never throws for expected failures, never sees req.

// "spectator" is a reserved word in nicknames so the server-applied "(SPECTATOR)" suffix is
// unambiguous and can't be spoofed by a player typing it into their own name.
const RESERVED_NICKNAME = 'spectator';
const SPECTATOR_SUFFIX = ' (SPECTATOR)';

const isReservedNickname = (nickname: string): boolean =>
  nickname.toLowerCase().includes(RESERVED_NICKNAME);

export interface CreateRoomResult {
  code: string;
  hostId: string;
  hostToken: string;
}

export interface JoinRoomResult {
  code: string;
  playerId: string;
  reconnectToken: string;
  spectator: boolean;
}

export interface SetLineupResult {
  code: string;
  lineup: LobbyLineupEntry[];
}

export class RoomsService {
  constructor(
    private readonly registry: RoomRegistry = roomRegistry,
    private readonly sessions: SessionManager = sessionManager,
  ) {}

  createRoom(hostNickname: string): ServiceResult<CreateRoomResult> {
    const { room, host } = this.registry.create(hostNickname.trim());
    return ServiceSuccess({ code: room.code, hostId: host.id, hostToken: host.reconnectToken });
  }

  joinRoom(code: string, nickname: string, spectator = false): ServiceResult<JoinRoomResult> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    if (room.phase === RoomPhase.CLOSED) {
      return ServiceError(ERROR_CODES.ROOM_CLOSED, MESSAGE_KEYS.rooms.CLOSED, 409);
    }
    if (room.phase !== RoomPhase.LOBBY) {
      return ServiceError(ERROR_CODES.NOT_IN_LOBBY, MESSAGE_KEYS.rooms.NOT_IN_LOBBY, 409);
    }
    if (this.registry.isFull(room)) {
      return ServiceError(ERROR_CODES.ROOM_FULL, MESSAGE_KEYS.rooms.FULL, 409);
    }
    const trimmed = nickname.trim();
    // "spectator" is reserved — the "(SPECTATOR)" tag is server-applied, never user-typed.
    if (isReservedNickname(trimmed)) {
      return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.rooms.NICKNAME_RESERVED, 422, {
        nickname: ['“Spectator” is reserved — pick another nickname.'],
      });
    }
    // Server applies the suffix so it shows everywhere (roster, scores) and can't be spoofed.
    const stored = spectator ? `${trimmed}${SPECTATOR_SUFFIX}` : trimmed;
    if (this.registry.hasNickname(room, stored)) {
      return ServiceError(ERROR_CODES.NICKNAME_TAKEN, MESSAGE_KEYS.rooms.NICKNAME_TAKEN, 409, {
        nickname: ['That nickname is taken.'],
      });
    }
    const player: RoomPlayer = this.registry.addPlayer(room, stored, spectator);
    return ServiceSuccess({
      code: room.code,
      playerId: player.id,
      reconnectToken: player.reconnectToken,
      spectator: player.spectator,
    });
  }

  // Publish the host's game lineup so players + display can see it in the lobby (read-only).
  // Host-only, lobby phase. The input is validated + bounded by the lineup module; unknown game
  // ids are dropped. Replaces the whole lineup each call (the host mirrors its local queue here,
  // so add/remove/reorder all publish through one path).
  setLineup(code: string, hostId: string, input: LineupInput): ServiceResult<SetLineupResult> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    if (room.hostId !== hostId) {
      return ServiceError(ERROR_CODES.NOT_HOST, MESSAGE_KEYS.games.NOT_HOST, 403);
    }
    if (room.phase !== RoomPhase.LOBBY) {
      return ServiceError(ERROR_CODES.NOT_IN_LOBBY, MESSAGE_KEYS.rooms.NOT_IN_LOBBY, 409);
    }
    const entries = toLineupEntries(input);
    this.registry.setLineup(room, entries);
    return ServiceSuccess({ code: room.code, lineup: entries });
  }

  // Start a single game in a room. Host-only; room must be in lobby with enough players. Delegates
  // session creation to the SessionManager (engine layer) — the service never touches the socket
  // transport. Views fan out through whatever sink the SessionManager holds (the gateway's at boot,
  // a no-op otherwise), so this is fully testable without a running socket server.
  async startGame(
    code: string,
    hostId: string,
    gameId: string,
    config: unknown,
    clientContent: unknown,
    ratingFilter: RatingFilter = DEFAULT_RATING_FILTER,
  ): Promise<ServiceResult<{ code: string; gameId: GameId; instanceId: string }>> {
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
    // Spectators never play: excluded from the plugin roster AND the min-player count (PRD §4/§10).
    const participants = room.players.filter((p) => !p.spectator);
    if (participants.length < plugin.manifest.players.min) {
      return ServiceError(ERROR_CODES.NOT_ENOUGH_PLAYERS, MESSAGE_KEYS.games.NOT_ENOUGH_PLAYERS, 409);
    }

    // Validate config at the service boundary → 422 on bad input (not a 500 from runtime .parse()).
    const configCheck = plugin.configSchema.safeParse(config);
    if (!configCheck.success) {
      return ServiceError(
        ERROR_CODES.VALIDATION_ERROR,
        MESSAGE_KEYS.common.VALIDATION_FAILED,
        422,
        zodFieldErrors(configCheck.error, 'config'),
      );
    }

    // Content is resolved SERVER-SIDE (PRD §8/§12): if the game registered a resolver, use it
    // (rating-filtered) and IGNORE any client-supplied content. Only games without a resolver
    // (e.g. the bare test games) fall back to client content.
    const resolver = getContentResolver(gameId);
    const seed = `${code}:${participants.length}:${gameId}`;
    const rawContent = resolver
      ? await resolver({ config: configCheck.data, ratingFilter, seed })
      : clientContent;

    const contentCheck = plugin.contentSchema.safeParse(rawContent);
    if (!contentCheck.success) {
      return ServiceError(
        ERROR_CODES.VALIDATION_ERROR,
        MESSAGE_KEYS.common.VALIDATION_FAILED,
        422,
        zodFieldErrors(contentCheck.error, 'content'),
      );
    }

    // Only participants enter the plugin — spectators get views (display projection) but no seat.
    const players: PlayerRef[] = participants.map((p) => ({ id: p.id, nickname: p.nickname }));
    const session = this.sessions.create({
      roomCode: code,
      gameId,
      players,
      config: configCheck.data,
      content: contentCheck.data,
      onEnded: (): void => {
        // Return the room to lobby when the game ends (PRD §4).
        room.phase = RoomPhase.LOBBY;
        room.activeGame = null;
        void this.sessions.end(code);
      },
    });
    if (!session) {
      return ServiceError(ERROR_CODES.GAME_NOT_FOUND, MESSAGE_KEYS.games.NOT_FOUND, 404);
    }

    const resolvedId = plugin.manifest.id; // the validated, typed GameId
    room.phase = RoomPhase.IN_GAME;
    room.activeGame = { instanceId: session.runtime.instanceId, gameId: resolvedId };
    this.registry.touch(room);

    return ServiceSuccess({ code, gameId: resolvedId, instanceId: session.runtime.instanceId });
  }

  // A lobby snapshot for the host dashboard + player/display lobbies (no PII beyond chosen
  // nicknames, PRD §12). Carries the host's published lineup so players/display see what's queued.
  lobby(code: string): ServiceResult<{
    code: string;
    phase: Room['phase'];
    players: { id: string; nickname: string; spectator: boolean }[];
    lineup: LobbyLineupEntry[];
  }> {
    const room = this.registry.get(code);
    if (!room) {
      return ServiceError(ERROR_CODES.ROOM_NOT_FOUND, MESSAGE_KEYS.rooms.NOT_FOUND, 404);
    }
    return ServiceSuccess({
      code: room.code,
      phase: room.phase,
      players: room.players.map((p) => ({ id: p.id, nickname: p.nickname, spectator: p.spectator })),
      lineup: room.lobbyLineup,
    });
  }
}

export const roomsService = new RoomsService();
