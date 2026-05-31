import type { Request, Response } from 'express';

import { env } from '../../env';
import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';

import { roomsService } from './rooms.service';

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

    const result = roomsService.joinRoom(code, nickname);
    if (!result.success) {
      fail(res, result);
      return;
    }
    ResponseUtil.created(res, result.data);
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
};
