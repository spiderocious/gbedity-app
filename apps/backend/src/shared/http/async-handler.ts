import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps async route handlers so rejected promises flow to the global error middleware.
// Every async route handler must be wrapped — bare async handlers leak unhandled rejections.

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
