import type { Request, Response } from 'express';

import { messages } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { catalogueService } from './catalogue.service';

// Thin public controller: call the service, map ServiceResult → ResponseUtil. The admin authoring
// endpoints live in the admin feature (admin.controller), behind requireAdmin — same split as the
// content authoring ports.

const fail = (res: Response, result: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, result.httpStatus, result.errorCode, messages.get(result.messageKey), result.fieldErrors);
};

export const catalogueController = {
  // GET /api/v1/catalogue — active games for the landing showcase.
  async list(_req: Request, res: Response): Promise<void> {
    const result = await catalogueService.listActive();
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.ok(res, result.data);
  },
};
