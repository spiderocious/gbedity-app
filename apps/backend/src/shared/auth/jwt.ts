import jwt from 'jsonwebtoken';

import { env } from '../../env';

// JWT helpers shared by admin + host auth. Access token (short-lived) carries the principal;
// refresh token (long-lived) carries a rotating family id for reuse-revoke.

export const Principal = { ADMIN: 'admin', HOST: 'host' } as const;
export type Principal = (typeof Principal)[keyof typeof Principal];

export interface AccessClaims {
  sub: string; // principal id
  kind: Principal;
}

export interface RefreshClaims {
  sub: string;
  kind: Principal;
  familyId: string; // rotates; old token reuse → revoke the family
  jti: string; // this token's unique id
}

export const signAccess = (claims: AccessClaims): string =>
  jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);

export const signRefresh = (claims: RefreshClaims): string =>
  jwt.sign(claims, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL } as jwt.SignOptions);

export const verifyAccess = (token: string): AccessClaims | null => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessClaims;
  } catch {
    return null;
  }
};

export const verifyRefresh = (token: string): RefreshClaims | null => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
  } catch {
    return null;
  }
};
