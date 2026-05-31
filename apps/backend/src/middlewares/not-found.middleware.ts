import type { Request, Response } from 'express';

import { ERROR_CODES } from '../shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '../shared/messages';
import { ResponseUtil } from '../shared/http/response';

// Unmatched route → the standard error envelope (mounted before the error handler).
export const notFoundHandler = (_req: Request, res: Response): void => {
  ResponseUtil.error(
    res,
    404,
    ERROR_CODES.NOT_FOUND,
    messages.get(MESSAGE_KEYS.common.NOT_FOUND),
  );
};
