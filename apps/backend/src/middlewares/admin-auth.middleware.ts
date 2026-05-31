import type { Request, Response, NextFunction } from 'express';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import { Principal, verifyAccess } from '@shared/auth/jwt';

// Guards /admin/* routes. Requires a valid admin access token. Attaches the admin id to req.
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
  const claims = token ? verifyAccess(token) : null;
  if (!claims || claims.kind !== Principal.ADMIN) {
    ResponseUtil.error(res, 401, ERROR_CODES.UNAUTHORIZED, messages.get(MESSAGE_KEYS.admin.UNAUTHORIZED));
    return;
  }
  (req as Request & { adminId?: string }).adminId = claims.sub;
  next();
};
