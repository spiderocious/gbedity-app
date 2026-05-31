import type { ErrorRequestHandler } from 'express';

import { logger } from '../lib/logger';
import { ERROR_CODES } from '../shared/http/error-codes';
import { AppError } from '../shared/http/errors';
import { messages, MESSAGE_KEYS } from '../shared/messages';
import { ResponseUtil } from '../shared/http/response';

// The one error handler, mounted last. Nothing else calls res.status(500).json().
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ errorCode: err.errorCode, msg: err.message }, 'app error');
    ResponseUtil.error(res, err.httpStatus, err.errorCode, err.message, err.fieldErrors);
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err: message }, 'unhandled error');
  ResponseUtil.error(
    res,
    500,
    ERROR_CODES.INTERNAL_ERROR,
    messages.get(MESSAGE_KEYS.common.INTERNAL_ERROR),
  );
};
