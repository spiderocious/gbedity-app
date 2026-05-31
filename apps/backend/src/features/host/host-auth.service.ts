import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { ID_PREFIX, newId } from '@shared/ids';
import { now } from '@shared/time';
import { Principal, signAccess, signRefresh, verifyRefresh } from '@shared/auth/jwt';

import { hostRepository, type HostRefreshFamily } from './host.repository';

// Host auth (5.1) — optional accounts. Register / login / refresh with reuse-revoke. Same shape as
// admin auth; hosts can also play without an account (the room flow needs no host account).

const BCRYPT_ROUNDS = 12;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const issueTokens = async (principalId: string): Promise<Tokens> => {
  const familyId = randomUUID();
  const jti = randomUUID();
  const family: HostRefreshFamily = { familyId, principalId, currentJti: jti, revoked: false, updatedAt: now() };
  await hostRepository.upsertFamily(family);
  return {
    accessToken: signAccess({ sub: principalId, kind: Principal.HOST }),
    refreshToken: signRefresh({ sub: principalId, kind: Principal.HOST, familyId, jti }),
  };
};

export class HostAuthService {
  async register(email: string, password: string): Promise<ServiceResult<Tokens>> {
    if (await hostRepository.findByEmail(email)) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.auth.EMAIL_TAKEN, 409);
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = newId(ID_PREFIX.HOST);
    await hostRepository.create({ id, email: email.toLowerCase(), passwordHash, createdAt: now() });
    return ServiceSuccess(await issueTokens(id));
  }

  async login(email: string, password: string): Promise<ServiceResult<Tokens>> {
    const host = await hostRepository.findByEmail(email);
    if (!host || !(await bcrypt.compare(password, host.passwordHash))) {
      return ServiceError(ERROR_CODES.INVALID_CREDENTIALS, MESSAGE_KEYS.auth.INVALID_CREDENTIALS, 401);
    }
    return ServiceSuccess(await issueTokens(host.id));
  }

  async refresh(refreshToken: string): Promise<ServiceResult<Tokens>> {
    const claims = verifyRefresh(refreshToken);
    if (!claims || claims.kind !== Principal.HOST) {
      return ServiceError(ERROR_CODES.TOKEN_INVALID, MESSAGE_KEYS.auth.TOKEN_INVALID, 401);
    }
    const family = await hostRepository.getFamily(claims.familyId);
    if (!family || family.revoked) {
      return ServiceError(ERROR_CODES.SESSION_REVOKED, MESSAGE_KEYS.auth.SESSION_REVOKED, 401);
    }
    if (family.currentJti !== claims.jti) {
      await hostRepository.revokeFamily(claims.familyId);
      return ServiceError(ERROR_CODES.SESSION_REVOKED, MESSAGE_KEYS.auth.SESSION_REVOKED, 401);
    }
    const jti = randomUUID();
    await hostRepository.upsertFamily({ ...family, currentJti: jti, updatedAt: now() });
    return ServiceSuccess({
      accessToken: signAccess({ sub: claims.sub, kind: Principal.HOST }),
      refreshToken: signRefresh({ sub: claims.sub, kind: Principal.HOST, familyId: claims.familyId, jti }),
    });
  }
}

export const hostAuthService = new HostAuthService();
