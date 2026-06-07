import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { zodFieldErrors } from '@shared/http/zod-errors';
import { MESSAGE_KEYS } from '@shared/messages';
import { roomRegistry, type RoomRegistry } from '@engine/room/room-registry';
import { RoomPhase } from '@engine/room/room.types';
import { getPlugin } from '@engine/registry';
import { getContentResolver } from '@engine/content-resolver';
import { sessionManager, type SessionManager } from '@engine/session/session-manager';
import type { GameId } from '@engine/constants';
import type { PlayerRef } from '@engine/types';
import { DEFAULT_RATING_FILTER, type RatingFilter } from '@features/content/content.constants';

// Single-player mode (docs/backend/single-player-spec.md). One human, no other players. A solo game
// is an ephemeral 1-player room where the player is also the host; the player's device is player +
// display + host at once. Reuses the SAME SessionManager / SingleSession / GameRuntime as
// multiplayer — solo is purely a thin start path, not a new engine.
//
// Eligibility: a game is solo-able ONLY when manifest.solo.supported === true (the peer-vote /
// peer-rate games declare nothing and are refused). disabledConfig keys are stripped before start
// (e.g. Millionaire's audience-poll / phone-a-friend lifelines have nobody to use).

const DEFAULT_NICKNAME = 'You';

export interface StartSoloResult {
  soloId: string; // the room code (opaque to the client)
  gameId: GameId;
  instanceId: string;
  playerId: string;
  reconnectToken: string;
  wsRole: 'player';
}

// Drop disabledConfig keys from a config object (solo strips lifelines that need other humans).
const stripDisabled = (config: unknown, disabled: string[] | undefined): unknown => {
  if (!disabled || disabled.length === 0 || typeof config !== 'object' || config === null) return config;
  const out: Record<string, unknown> = { ...(config as Record<string, unknown>) };
  for (const key of disabled) delete out[key];
  // Also prune disabled entries from an array-valued `lifelines`/`enabled` style field if present.
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v)) out[k] = v.filter((item) => !disabled.includes(String(item)));
  }
  return out;
};

export class SoloService {
  constructor(
    private readonly registry: RoomRegistry = roomRegistry,
    private readonly sessions: SessionManager = sessionManager,
  ) {}

  async start(
    nickname: string | undefined,
    gameId: string,
    config: unknown,
    ratingFilter: RatingFilter = DEFAULT_RATING_FILTER,
  ): Promise<ServiceResult<StartSoloResult>> {
    const plugin = getPlugin(gameId);
    if (!plugin) {
      return ServiceError(ERROR_CODES.GAME_NOT_FOUND, MESSAGE_KEYS.games.NOT_FOUND, 404);
    }
    if (plugin.manifest.solo?.supported !== true) {
      return ServiceError(ERROR_CODES.SOLO_NOT_SUPPORTED, MESSAGE_KEYS.solo.NOT_SUPPORTED, 409);
    }

    // Validate against the plugin schema (422 on bad input), THEN strip solo-disabled config.
    // Order matters (SP-1): Zod fills defaults during parse — e.g. Millionaire's `lifelines`
    // default includes ask_audience/phone_friend. Stripping the RAW client config would miss those
    // defaults (the client sends nothing → nothing to strip → defaults survive). So we strip the
    // PARSED config, after defaults are applied.
    const parsed = plugin.configSchema.safeParse(config);
    if (!parsed.success) {
      return ServiceError(
        ERROR_CODES.VALIDATION_ERROR,
        MESSAGE_KEYS.common.VALIDATION_FAILED,
        422,
        zodFieldErrors(parsed.error, 'config'),
      );
    }
    // soloConfig is the validated shape with disabled lifelines pruned — use it everywhere below.
    const soloConfig: unknown = stripDisabled(parsed.data, plugin.manifest.solo.disabledConfig);

    // Ephemeral 1-player room — the player is the host.
    const { room, host } = this.registry.create((nickname ?? DEFAULT_NICKNAME).trim() || DEFAULT_NICKNAME);

    // Content resolved server-side (same as multiplayer). No resolver ⇒ empty content (the schema
    // either accepts it or 422s, which surfaces a misconfigured solo game honestly).
    const resolver = getContentResolver(gameId);
    const seed = `solo:${room.code}:${gameId}`;
    const rawContent = resolver ? await resolver({ config: soloConfig, ratingFilter, seed }) : {};
    const contentCheck = plugin.contentSchema.safeParse(rawContent);
    if (!contentCheck.success) {
      this.registry.close(room.code);
      return ServiceError(
        ERROR_CODES.VALIDATION_ERROR,
        MESSAGE_KEYS.common.VALIDATION_FAILED,
        422,
        zodFieldErrors(contentCheck.error, 'content'),
      );
    }

    const players: PlayerRef[] = [{ id: host.id, nickname: host.nickname }];
    const session = this.sessions.create({
      roomCode: room.code,
      gameId,
      players,
      config: soloConfig,
      content: contentCheck.data,
      onEnded: (): void => {
        // Solo game over → tear the ephemeral room down entirely (no lobby to return to).
        void this.sessions.end(room.code);
        this.registry.close(room.code);
      },
    });
    if (!session) {
      this.registry.close(room.code);
      return ServiceError(ERROR_CODES.GAME_NOT_FOUND, MESSAGE_KEYS.games.NOT_FOUND, 404);
    }

    const resolvedId = plugin.manifest.id;
    room.phase = RoomPhase.IN_GAME;
    room.activeGame = { instanceId: session.runtime.instanceId, gameId: resolvedId };
    this.registry.touch(room);

    return ServiceSuccess({
      soloId: room.code,
      gameId: resolvedId,
      instanceId: session.runtime.instanceId,
      playerId: host.id,
      reconnectToken: host.reconnectToken,
      wsRole: 'player',
    });
  }

  // Current state snapshot for a solo game (reconnect / poll). Returns null-result as 404.
  state(soloId: string): ServiceResult<{ soloId: string; gameId: GameId | null; phase: string; over: boolean }> {
    const room = this.registry.get(soloId);
    if (!room) {
      return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    }
    const runtime = this.sessions.activeRuntime(soloId);
    return ServiceSuccess({
      soloId,
      gameId: room.activeGame?.gameId ?? null,
      phase: room.phase,
      over: runtime ? runtime.isOver() : true,
    });
  }
}

export const soloService = new SoloService();
