import type { Request, Response } from 'express';

import { messages } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { wsSoloService } from './ws-solo.service';

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const soloId = (req: Request): string => (typeof req.body?.soloId === 'string' ? req.body.soloId : '');

export const wsSoloController = {
  // POST /solo/wordshot/start — body: { config? } → { soloId, rounds, config }
  async start(req: Request, res: Response): Promise<void> {
    const config: unknown = req.body?.config ?? {};
    const result = await wsSoloService.start(config);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  // POST /solo/wordshot/round — body: { soloId } → { idx, rounds, letter, category, secondsPerRound }
  round(req: Request, res: Response): void {
    const result = wsSoloService.round(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/wordshot/guess — body: { soloId, text, elapsedMs, timeout? } → { correct, points, totalScore, ... }
  async guess(req: Request, res: Response): Promise<void> {
    const timeout = req.body?.timeout === true;
    const result = await wsSoloService.guess(soloId(req), req.body?.text, req.body?.elapsedMs, timeout);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/wordshot/next — body: { soloId } → { done, idx, rounds, totalScore }
  next(req: Request, res: Response): void {
    const result = wsSoloService.next(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // GET /solo/wordshot/:soloId — snapshot for reconnect/poll
  snapshot(req: Request, res: Response): void {
    const id = typeof req.params.soloId === 'string' ? req.params.soloId : '';
    const result = wsSoloService.snapshot(id);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
