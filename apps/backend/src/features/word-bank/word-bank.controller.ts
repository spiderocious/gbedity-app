import type { Request, Response } from 'express';

import { ERROR_CODES } from '@shared/http/error-codes';
import { messages, MESSAGE_KEYS } from '@shared/messages';
import { ResponseUtil } from '@shared/http/response';
import { zodFieldErrors } from '@shared/http/zod-errors';

import { wordBankRepository } from './word-bank.repository';
import { wordBankService } from './word-bank.service';
import {
  promoteDefinitionsSchema,
  promoteWordsSchema,
  referenceSourceSchema,
  updateDefinitionSchema,
  updateWordSchema,
} from './word-bank.schema';

// HTTP surface for the word bank — browse reference collections, promote into the operational sets,
// and manage what's promoted (rank/difficulty/remove). Mounted under /api/v1/admin (requireAdmin).

const clampLimit = (raw: unknown, def = 50, max = 200): number => {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(1, Math.floor(n))) : def;
};

const param = (req: Request, key: string): string => {
  const v = req.params[key];
  return typeof v === 'string' ? v : '';
};

const str = (raw: unknown): string | undefined => (typeof raw === 'string' && raw !== '' ? raw : undefined);

// Word-list pagination: sort by `word` ascending, cursor = the last word on the page.
const pageMeta = <T extends { word: string }>(rows: T[], limit: number): { next_cursor: string | null; has_more: boolean } => {
  const last = rows.at(-1);
  const nextCursor = rows.length === limit && last ? last.word : null;
  return { next_cursor: nextCursor, has_more: nextCursor !== null };
};

const validationError = (res: Response, fieldErrors: Record<string, string[]>): void =>
  ResponseUtil.error(res, 422, ERROR_CODES.VALIDATION_ERROR, messages.get(MESSAGE_KEYS.common.VALIDATION_FAILED), fieldErrors);

export const wordBankController = {
  // ── Reference browse ─────────────────────────────────────────────────────────
  async listReference(req: Request, res: Response): Promise<void> {
    const parsed = referenceSourceSchema.safeParse(param(req, 'source'));
    if (!parsed.success) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.common.NOT_FOUND));
    const limit = clampLimit(req.query.limit);
    const cursor = str(req.query.cursor);
    const search = str(req.query.search);
    const rows = await wordBankRepository.listReference({
      source: parsed.data,
      limit,
      ...(cursor !== undefined && { afterWord: cursor }),
      ...(search !== undefined && { search }),
    });
    ResponseUtil.ok(res, rows, pageMeta(rows, limit));
  },

  // ── game_words ──────────────────────────────────────────────────────────────
  async listWords(req: Request, res: Response): Promise<void> {
    const limit = clampLimit(req.query.limit);
    const cursor = str(req.query.cursor);
    const search = str(req.query.search);
    const rows = await wordBankRepository.listWords({
      limit,
      ...(cursor !== undefined && { afterWord: cursor }),
      ...(search !== undefined && { search }),
    });
    ResponseUtil.ok(res, rows, pageMeta(rows, limit));
  },

  async promoteWords(req: Request, res: Response): Promise<void> {
    const parsed = promoteWordsSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationError(res, zodFieldErrors(parsed.error, 'word-bank'));
    const result = await wordBankService.promoteWords(parsed.data);
    ResponseUtil.ok(res, result);
  },

  async updateWord(req: Request, res: Response): Promise<void> {
    const parsed = updateWordSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationError(res, zodFieldErrors(parsed.error, 'word-bank'));
    const updated = await wordBankRepository.updateWord(param(req, 'id'), parsed.data);
    if (!updated) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.common.NOT_FOUND));
    ResponseUtil.ok(res, updated);
  },

  async deleteWord(req: Request, res: Response): Promise<void> {
    const ok = await wordBankRepository.removeWord(param(req, 'id'));
    if (!ok) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.common.NOT_FOUND));
    ResponseUtil.noContent(res);
  },

  // ── game_definitions ─────────────────────────────────────────────────────────
  async listDefinitions(req: Request, res: Response): Promise<void> {
    const limit = clampLimit(req.query.limit);
    const cursor = str(req.query.cursor);
    const search = str(req.query.search);
    const rows = await wordBankRepository.listDefinitions({
      limit,
      ...(cursor !== undefined && { afterWord: cursor }),
      ...(search !== undefined && { search }),
    });
    ResponseUtil.ok(res, rows, pageMeta(rows, limit));
  },

  async promoteDefinitions(req: Request, res: Response): Promise<void> {
    const parsed = promoteDefinitionsSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationError(res, zodFieldErrors(parsed.error, 'word-bank'));
    const result = await wordBankService.promoteDefinitions(parsed.data);
    ResponseUtil.ok(res, result);
  },

  async updateDefinition(req: Request, res: Response): Promise<void> {
    const parsed = updateDefinitionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationError(res, zodFieldErrors(parsed.error, 'word-bank'));
    const updated = await wordBankRepository.updateDefinition(param(req, 'id'), parsed.data);
    if (!updated) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.common.NOT_FOUND));
    ResponseUtil.ok(res, updated);
  },

  async deleteDefinition(req: Request, res: Response): Promise<void> {
    const ok = await wordBankRepository.removeDefinition(param(req, 'id'));
    if (!ok) return ResponseUtil.error(res, 404, ERROR_CODES.NOT_FOUND, messages.get(MESSAGE_KEYS.common.NOT_FOUND));
    ResponseUtil.noContent(res);
  },
};
