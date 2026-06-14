import type { Request, Response } from 'express';

import { messages } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { invSoloService } from './inv-solo.service';

// Client-driven solo Investigation. Thin HTTP layer: the client paces the case; these are plain
// request/response calls, no socket.

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const soloId = (req: Request): string => (typeof req.body?.soloId === 'string' ? req.body.soloId : '');

export const invSoloController = {
  // POST /solo/investigation/start — body: { config? } → { soloId, investigateSeconds, theCase }
  async start(req: Request, res: Response): Promise<void> {
    const result = await invSoloService.start(req.body?.config ?? {});
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  // POST /solo/investigation/accuse — body: { soloId, suspectId, evidenceId?, confidence?, elapsedMs? }
  accuse(req: Request, res: Response): void {
    const result = invSoloService.accuse(soloId(req), req.body?.suspectId, req.body?.evidenceId, req.body?.confidence, req.body?.elapsedMs);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // GET /solo/investigation/:soloId — snapshot
  snapshot(req: Request, res: Response): void {
    const id = typeof req.params.soloId === 'string' ? req.params.soloId : '';
    const result = invSoloService.snapshot(id);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
