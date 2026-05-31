import type { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

import { requestContext, type RequestContext } from '../shared/http/request-context';

// Seeds AsyncLocalStorage with a per-request context and echoes X-Request-Id.
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const headerId = req.headers['x-request-id'];
  const requestId = typeof headerId === 'string' && headerId.length > 0 ? headerId : ulid();

  res.setHeader('X-Request-Id', requestId);

  const ctx: RequestContext = { requestId };
  requestContext.run(ctx, () => next());
};
