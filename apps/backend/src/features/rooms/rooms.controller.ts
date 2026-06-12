import type { Request, Response } from 'express';

import { env } from '../../env';
import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { roomsService } from './rooms.service';
import { LineupInput } from './lineup';

// Thin controllers: validate shape, call the service, map ServiceResult → ResponseUtil envelope.

const fail = (res: Response, result: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, result.httpStatus, result.errorCode, messages.get(result.messageKey), result.fieldErrors);
};

const paramCode = (req: Request): string => {
  const code = req.params.code;
  return typeof code === 'string' ? code : '';
};

const requireString = (res: Response, value: unknown, field: string): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
      [field]: ['Required.'],
    });
    return null;
  }
  return value;
};

export const roomsController = {
  create(req: Request, res: Response): void {
    const nickname = requireString(res, req.body?.nickname, 'nickname');
    if (nickname === null) return;

    const result = roomsService.createRoom(nickname);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.created(res, {
      ...result.data,
      // The host opens this on a TV/laptop separately (PRD §4).
      display_url: `${env.WEB_BASE_URL}/display/${result.data.code}`,
      join_url: `${env.WEB_BASE_URL}/join/${result.data.code}`,
    });
  },

  join(req: Request, res: Response): void {
    const code = paramCode(req).toUpperCase();
    const nickname = requireString(res, req.body?.nickname, 'nickname');
    if (nickname === null) return;
    // Optional opt-in: a spectator watches the room but never plays (PRD §4/§10).
    const spectator = req.body?.spectator === true;

    const result = roomsService.joinRoom(code, nickname, spectator);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.created(res, result.data);
  },

  // Convert the caller's existing seat to a spectator in place (no new seat).
  spectate(req: Request, res: Response): void {
    const code = paramCode(req).toUpperCase();
    const playerId = requireString(res, req.body?.playerId, 'playerId');
    if (playerId === null) return;
    const result = roomsService.spectate(code, playerId);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.ok(res, result.data);
  },

  lobby(req: Request, res: Response): void {
    const code = paramCode(req).toUpperCase();
    const result = roomsService.lobby(code);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.ok(res, result.data);
  },

  setLineup(req: Request, res: Response): void {
    const code = paramCode(req).toUpperCase();
    const hostId = requireString(res, req.body?.hostId, 'hostId');
    if (hostId === null) return;

    const parsed = LineupInput.safeParse({ lineup: req.body?.lineup });
    if (!parsed.success) {
      ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
        lineup: ['Invalid lineup.'],
      });
      return;
    }

    const result = roomsService.setLineup(code, hostId, parsed.data);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.ok(res, result.data);
  },

  async start(req: Request, res: Response): Promise<void> {
    const code = paramCode(req).toUpperCase();
    const hostId = requireString(res, req.body?.hostId, 'hostId');
    if (hostId === null) return;
    const gameId = requireString(res, req.body?.gameId, 'gameId');
    if (gameId === null) return;

    // config is opaque to the controller (plugin Zod validates). content is resolved SERVER-SIDE by
    // the service when the game has a resolver; client content is a fallback only (test games).
    const config: unknown = req.body?.config ?? {};
    const content: unknown = req.body?.content ?? {};

    const result = await roomsService.startGame(code, hostId, gameId, config, content);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.created(res, result.data);
  },

  async endGame(req: Request, res: Response): Promise<void> {
    const code = paramCode(req).toUpperCase();
    const hostId = requireString(res, req.body?.hostId, 'hostId');
    if (hostId === null) return;

    const result = await roomsService.endGame(code, hostId);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.ok(res, result.data);
  },
};
