import type { Request, Response } from 'express';
import { z } from 'zod';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import type { ServiceResult } from '@shared/http/service-result';
import { encodeCursor, decodeCursor } from '@shared/cursor';
import { zodFieldErrors } from '@shared/http/zod-errors';
import { gamePlaysRepository } from '@features/game-plays/game-plays.repository';

import { adminAuthService } from './admin-auth.service';
import { contentAdminRepository } from './content-admin.repository';
import { contentSchemaFor } from './content-schemas';

const fail = (res: Response, r: Extract<ServiceResult<unknown>, { success: false }>): void => {
  ResponseUtil.error(res, r.httpStatus, r.errorCode, messages.get(r.messageKey), r.fieldErrors);
};

const requireField = (res: Response, value: unknown, field: string): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
      [field]: ['Required.'],
    });
    return null;
  }
  return value;
};

const clampLimit = (raw: unknown, def = 20, max = 100): number => {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(1, Math.floor(n))) : def;
};

const param = (req: Request, key: string): string => {
  const v = req.params[key];
  return typeof v === 'string' ? v : '';
};

export const adminController = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async seed(req: Request, res: Response): Promise<void> {
    const email = requireField(res, req.body?.email, 'email');
    if (email === null) return;
    const result = await adminAuthService.seed(email);
    if (!result.success) return fail(res, result);
    ResponseUtil.created(res, result.data); // { email, password } — shown once
  },

  async login(req: Request, res: Response): Promise<void> {
    const email = requireField(res, req.body?.email, 'email');
    if (email === null) return;
    const password = requireField(res, req.body?.password, 'password');
    if (password === null) return;
    const result = await adminAuthService.login(email, password);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = requireField(res, req.body?.refreshToken, 'refreshToken');
    if (token === null) return;
    const result = await adminAuthService.refresh(token);
    if (!result.success) return fail(res, result);
    ResponseUtil.ok(res, result.data);
  },

  // ── Content authoring (full CRUD per kind) ──────────────────────────────────
  async createContent(req: Request, res: Response): Promise<void> {
    const kind = param(req, 'kind');
    const schema = contentSchemaFor(kind);
    if (!schema) {
      return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    }
    // Validate the authored document against the per-kind schema (BUG-B). ratingTier is required.
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), zodFieldErrors(parsed.error, kind));
    }
    const doc = await contentAdminRepository.create(kind, parsed.data as Record<string, unknown>);
    if (!doc) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    ResponseUtil.created(res, doc);
  },

  async listContent(req: Request, res: Response): Promise<void> {
    const kind = param(req, 'kind');
    if (!contentAdminRepository.isKnownKind(kind)) {
      return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    }
    const limit = clampLimit(req.query.limit);
    const cursorRaw = typeof req.query.cursor === 'string' ? decodeCursor(req.query.cursor) : null;
    const beforeId = cursorRaw?.lastId;
    const docs = await contentAdminRepository.list(kind, { limit, ...(beforeId !== undefined && { beforeId }) });
    const last = docs.at(-1);
    // Cursor carries the ObjectId hex (monotonic, type-uniform). Strip cursorId from the payload.
    const nextCursor =
      docs.length === limit && last ? encodeCursor({ lastId: last.cursorId, lastSortKey: last.cursorId }) : null;
    const data = docs.map(({ cursorId: _cursorId, ...d }) => d);
    ResponseUtil.ok(res, data, { next_cursor: nextCursor, has_more: nextCursor !== null });
  },

  async getContent(req: Request, res: Response): Promise<void> {
    const doc = await contentAdminRepository.get(param(req, 'kind'), param(req, 'id'));
    if (!doc) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    ResponseUtil.ok(res, doc);
  },

  async updateContent(req: Request, res: Response): Promise<void> {
    const kind = param(req, 'kind');
    const schema = contentSchemaFor(kind);
    if (!schema) {
      return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    }
    // PATCH validates against the partial schema (any subset of valid fields).
    const partial = schema instanceof z.ZodObject ? schema.partial() : schema;
    const parsed = partial.safeParse(req.body ?? {});
    if (!parsed.success) {
      return ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), zodFieldErrors(parsed.error, kind));
    }
    const doc = await contentAdminRepository.update(kind, param(req, 'id'), parsed.data as Record<string, unknown>);
    if (!doc) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    ResponseUtil.ok(res, doc);
  },

  async deleteContent(req: Request, res: Response): Promise<void> {
    const ok = await contentAdminRepository.remove(param(req, 'kind'), param(req, 'id'));
    if (!ok) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    ResponseUtil.noContent(res);
  },

  // ── Rubric recalibration (2.4) ──────────────────────────────────────────────
  async getRubric(_req: Request, res: Response): Promise<void> {
    const rubric = await contentAdminRepository.getRubric();
    ResponseUtil.ok(res, rubric ?? { key: 'default', criteria: [] });
  },

  async setRubric(req: Request, res: Response): Promise<void> {
    const criteria = req.body?.criteria;
    if (!Array.isArray(criteria)) {
      return ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), {
        criteria: ['Required array of {key,label,weight}.'],
      });
    }
    await contentAdminRepository.setRubric(criteria as { key: string; label: string; weight: number }[]);
    ResponseUtil.ok(res, { ok: true });
  },

  // ── History + metrics (2.2 / 2.5) ───────────────────────────────────────────
  async listGamePlays(req: Request, res: Response): Promise<void> {
    const limit = clampLimit(req.query.limit);
    const cursorRaw = typeof req.query.cursor === 'string' ? decodeCursor(req.query.cursor) : null;
    const before = cursorRaw ? Number(cursorRaw.lastSortKey) : undefined;
    const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : undefined;
    const plays = await gamePlaysRepository.listPlays({
      limit,
      ...(before !== undefined && { before }),
      ...(gameId !== undefined && { gameId }),
    });
    const last = plays.at(-1);
    const nextCursor = plays.length === limit && last ? encodeCursor({ lastId: last.id, lastSortKey: String(last.createdAt) }) : null;
    ResponseUtil.ok(res, plays, { next_cursor: nextCursor, has_more: nextCursor !== null });
  },

  async getGamePlay(req: Request, res: Response): Promise<void> {
    const play = await gamePlaysRepository.getPlay(param(req, 'id'));
    if (!play) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.admin.NOT_FOUND));
    ResponseUtil.ok(res, play);
  },

  async sessionEvents(req: Request, res: Response): Promise<void> {
    const events = await gamePlaysRepository.listEvents(param(req, 'instanceId'));
    ResponseUtil.ok(res, events);
  },

  async metrics(_req: Request, res: Response): Promise<void> {
    const byGame = await gamePlaysRepository.metricsByGame();
    ResponseUtil.ok(res, { byGame });
  },
};
