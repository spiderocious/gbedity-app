import type { Request, Response } from 'express';

import { messages } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { mlSoloService } from './ml-solo.service';

// Client-driven solo Missing Letters. Thin HTTP layer: pull typed fields off the body, call the
// service, map the ServiceResult through ResponseUtil. The CLIENT owns pacing — these are plain
// request/response calls, no socket.

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const soloId = (req: Request): string => (typeof req.body?.soloId === 'string' ? req.body.soloId : '');

export const mlSoloController = {
  // POST /solo/missing-letters/start — body: { config? } → { soloId, rounds, config }
  async start(req: Request, res: Response): Promise<void> {
    const config: unknown = req.body?.config ?? {};
    const result = await mlSoloService.start(config);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  // POST /solo/missing-letters/round — body: { soloId } → masked word (answer withheld)
  round(req: Request, res: Response): void {
    const result = mlSoloService.round(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/missing-letters/guess — body: { soloId, text, elapsedMs, timeout? } → { correct, points, answer, ... }
  guess(req: Request, res: Response): void {
    const timeout = req.body?.timeout === true;
    const result = mlSoloService.guess(soloId(req), req.body?.text, req.body?.elapsedMs, timeout);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/missing-letters/next — body: { soloId } → { done, idx, rounds, totalScore }
  next(req: Request, res: Response): void {
    const result = mlSoloService.next(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // GET /solo/missing-letters/:soloId — snapshot for reconnect/poll
  snapshot(req: Request, res: Response): void {
    const id = typeof req.params.soloId === 'string' ? req.params.soloId : '';
    const result = mlSoloService.snapshot(id);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
