import type { Request, Response } from 'express';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';
import { listPlugins } from '@engine/registry';

import { soloService } from './solo.service';

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const param = (req: Request, key: string): string => {
  const v = req.params[key];
  return typeof v === 'string' ? v : '';
};

export const soloController = {
  // POST /solo/start — start a solo game. Body: { nickname?, gameId, config? }
  async start(req: Request, res: Response): Promise<void> {
    const gameId = typeof req.body?.gameId === 'string' ? req.body.gameId : '';
    if (gameId.length === 0) {
      return ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
        gameId: ['Required.'],
      });
    }
    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname : undefined;
    const config: unknown = req.body?.config ?? {};

    const result = await soloService.start(nickname, gameId, config);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  // GET /solo/:soloId — snapshot for reconnect/poll.
  state(req: Request, res: Response): void {
    const result = soloService.state(param(req, 'soloId'));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // GET /solo/games — the games playable solo (id + title + which are solo-supported).
  games(_req: Request, res: Response): void {
    const games = listPlugins()
      .filter((p) => p.manifest.solo?.supported === true)
      .map((p) => ({
        gameId: p.manifest.id,
        title: p.manifest.title,
        category: p.manifest.category,
        mode: p.manifest.mode,
      }));
    ResponseUtil.ok(res, { games });
  },
};
