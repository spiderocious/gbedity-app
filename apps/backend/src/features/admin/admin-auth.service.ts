import { randomBytes, randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { env } from '../../env';
import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { ID_PREFIX, newId } from '@shared/ids';
import { now } from '@shared/time';
import { Principal, signAccess, signRefresh, verifyRefresh } from '@shared/auth/jwt';

import { adminRepository, type RefreshFamily } from './admin.repository';

// Admin auth: one-shot env-gated seed, login, refresh rotation with reuse-revoke (2.1).

const BCRYPT_ROUNDS = 12;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const issueTokens = async (principalId: string): Promise<Tokens> => {
  const familyId = randomUUID();
  const jti = randomUUID();
  const refreshFamily: RefreshFamily = { familyId, principalId, currentJti: jti, revoked: false, updatedAt: now() };
  await adminRepository.upsertFamily(refreshFamily);
  return {
    accessToken: signAccess({ sub: principalId, kind: Principal.ADMIN }),
    refreshToken: signRefresh({ sub: principalId, kind: Principal.ADMIN, familyId, jti }),
  };
};

export class AdminAuthService {
  // One-shot idempotent seed (env-gated). Generates a strong password, returns it ONCE. 409 after.
  async seed(email: string): Promise<ServiceResult<{ email: string; password: string }>> {
    if (!env.CAN_SEED_ADMIN) {
      return ServiceError(ERROR_CODES.FORBIDDEN, MESSAGE_KEYS.admin.SEED_DISABLED, 403);
    }
    if ((await adminRepository.count()) > 0) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.admin.ALREADY_SEEDED, 409);
    }
    const password = randomBytes(12).toString('base64url'); // server-generated strong password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await adminRepository.create({ id: newId(ID_PREFIX.ADMIN), email: email.toLowerCase(), passwordHash, createdAt: now() });
    // returned ONCE in the body (logs still redact `password`).
    return ServiceSuccess({ email: email.toLowerCase(), password });
  }

  async login(email: string, password: string): Promise<ServiceResult<Tokens>> {
    const admin = await adminRepository.findByEmail(email);
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return ServiceError(ERROR_CODES.INVALID_CREDENTIALS, MESSAGE_KEYS.admin.INVALID_CREDENTIALS, 401);
    }
    return ServiceSuccess(await issueTokens(admin.id));
  }

  // Rotate: a valid current refresh issues a new pair (new jti). Reuse of a superseded jti → the
  // whole family is revoked (reuse-detection).
  async refresh(refreshToken: string): Promise<ServiceResult<Tokens>> {
    const claims = verifyRefresh(refreshToken);
    if (!claims || claims.kind !== Principal.ADMIN) {
      return ServiceError(ERROR_CODES.TOKEN_INVALID, MESSAGE_KEYS.admin.TOKEN_INVALID, 401);
    }
    const family = await adminRepository.getFamily(claims.familyId);
    if (!family || family.revoked) {
      return ServiceError(ERROR_CODES.SESSION_REVOKED, MESSAGE_KEYS.admin.SESSION_REVOKED, 401);
    }
    if (family.currentJti !== claims.jti) {
      // a superseded token was replayed → revoke the family (reuse attack)
      await adminRepository.revokeFamily(claims.familyId);
      return ServiceError(ERROR_CODES.SESSION_REVOKED, MESSAGE_KEYS.admin.SESSION_REVOKED, 401);
    }
    const jti = randomUUID();
    await adminRepository.upsertFamily({ ...family, currentJti: jti, updatedAt: now() });
    return ServiceSuccess({
      accessToken: signAccess({ sub: claims.sub, kind: Principal.ADMIN }),
      refreshToken: signRefresh({ sub: claims.sub, kind: Principal.ADMIN, familyId: claims.familyId, jti }),
    });
  }
}

export const adminAuthService = new AdminAuthService();
