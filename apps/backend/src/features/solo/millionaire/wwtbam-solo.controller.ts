import type { Request, Response } from 'express';

import { messages } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { wwtbamSoloService } from './wwtbam-solo.service';

// Client-driven solo WWTBAM. Thin HTTP layer: pull typed fields off the body, call the service,
// map the ServiceResult through ResponseUtil. The CLIENT owns pacing — plain request/response, no socket.

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const soloId = (req: Request): string =>
  typeof req.body?.soloId === 'string' ? req.body.soloId : '';

export const wwtbamSoloController = {
  // POST /solo/millionaire/start — body: { config? } → { soloId, questionCount, config, ladder }
  async start(req: Request, res: Response): Promise<void> {
    const config: unknown = req.body?.config ?? {};
    const result = await wwtbamSoloService.start(config);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  // POST /solo/millionaire/question — body: { soloId } → current question (answer withheld)
  question(req: Request, res: Response): void {
    const result = wwtbamSoloService.question(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/millionaire/answer — body: { soloId, choiceIdx, timeout? } → { correct, answerIdx, ... }
  answer(req: Request, res: Response): void {
    const timeout = req.body?.timeout === true;
    const result = wwtbamSoloService.answer(soloId(req), req.body?.choiceIdx, timeout);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/millionaire/next — body: { soloId } → { done, idx, questionCount, totalBanked, eliminated }
  next(req: Request, res: Response): void {
    const result = wwtbamSoloService.next(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // POST /solo/millionaire/fifty-fifty — body: { soloId } → { hidden: [n, n] }
  fiftyFifty(req: Request, res: Response): void {
    const result = wwtbamSoloService.fiftyFifty(soloId(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // GET /solo/millionaire/:soloId — snapshot for reconnect
  snapshot(req: Request, res: Response): void {
    const id = typeof req.params.soloId === 'string' ? req.params.soloId : '';
    const result = wwtbamSoloService.snapshot(id);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
