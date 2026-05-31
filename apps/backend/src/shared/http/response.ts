import type { Response } from 'express';

import type { ErrorCode } from './error-codes';
import type { FieldErrors } from './service-result';

// The single place a handler shapes a response. Never call res.json() directly in a handler.
// Success: { data, meta? }   Error: { error: { code, message, field_errors? } }

interface Meta {
  next_cursor?: string | null;
  has_more?: boolean;
}

export const ResponseUtil = {
  ok<T>(res: Response, data: T, meta?: Meta): void {
    res.status(200).json(meta !== undefined ? { data, meta } : { data });
  },

  created<T>(res: Response, data: T): void {
    res.status(201).json({ data });
  },

  noContent(res: Response): void {
    res.status(204).end();
  },

  error(
    res: Response,
    status: number,
    code: ErrorCode,
    message: string,
    fieldErrors?: FieldErrors,
  ): void {
    res.status(status).json({
      error: {
        code,
        message,
        ...(fieldErrors !== undefined && { field_errors: fieldErrors }),
      },
    });
  },
};
