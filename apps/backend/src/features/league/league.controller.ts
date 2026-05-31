import type { Request, Response } from 'express';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { leagueService, type QueueEntryInput } from './league.service';

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const code = (req: Request): string => (typeof req.params.code === 'string' ? req.params.code.toUpperCase() : '');

export const leagueController = {
  async start(req: Request, res: Response): Promise<void> {
    const hostId = req.body?.hostId;
    if (typeof hostId !== 'string' || hostId.length === 0) {
      return ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
        hostId: ['Required.'],
      });
    }
    const queue = Array.isArray(req.body?.queue) ? (req.body.queue as QueueEntryInput[]) : [];
    const aggregate = typeof req.body?.aggregate === 'string' ? req.body.aggregate : 'sum';

    const result = await leagueService.startLeague(code(req), hostId, queue, aggregate);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  standings(req: Request, res: Response): void {
    const result = leagueService.standings(code(req));
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
