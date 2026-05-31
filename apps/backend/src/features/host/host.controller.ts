import type { Request, Response } from 'express';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { hostAuthService } from './host-auth.service';

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const field = (res: Response, value: unknown, name: string, min = 1): string | null => {
  if (typeof value !== 'string' || value.trim().length < min) {
    ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
      [name]: [min > 1 ? `Must be at least ${min} characters.` : 'Required.'],
    });
    return null;
  }
  return value;
};

export const hostController = {
  async register(req: Request, res: Response): Promise<void> {
    const email = field(res, req.body?.email, 'email');
    if (email === null) return;
    const password = field(res, req.body?.password, 'password', 8);
    if (password === null) return;
    const result = await hostAuthService.register(email, password);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data);
  },

  async login(req: Request, res: Response): Promise<void> {
    const email = field(res, req.body?.email, 'email');
    if (email === null) return;
    const password = field(res, req.body?.password, 'password');
    if (password === null) return;
    const result = await hostAuthService.login(email, password);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = field(res, req.body?.refreshToken, 'refreshToken');
    if (token === null) return;
    const result = await hostAuthService.refresh(token);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },
};
