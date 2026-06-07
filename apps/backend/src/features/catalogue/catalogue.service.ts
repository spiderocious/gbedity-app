import { logger } from '@lib/logger';
import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { getPlugin, listPlugins } from '@engine/registry';
import type { AnyGamePlugin } from '@engine/types';

import {
  CatalogueStatus,
  formatMeta,
  uiMappingFor,
  type CatalogueStatus as Status,
} from './catalogue.constants';
import { catalogueRepository, type CatalogueEntryDoc, type CatalogueEntryInput } from './catalogue.repository';
import type { CreateCatalogueInput, PublicCatalogueGame, UpdateCatalogueInput } from './catalogue.schema';

// Catalogue business logic. Returns ServiceResult — never throws for expected failures, never sees
// req. The public list JOINS active entries to live plugin manifests and TRANSLATES to the UI's
// encoding (spec §3.1). Admin ops author/curate the persisted entries (spec §3.2).

// Effective player range: admin overrides win, else the plugin manifest's values.
const effectivePlayers = (
  plugin: AnyGamePlugin,
  entry: CatalogueEntryDoc,
): { min: number; max: number | null; recommendedMax: number } => {
  const m = plugin.manifest.players;
  return {
    min: entry.playersMinOverride ?? m.min,
    max: entry.playersMaxOverride !== undefined ? entry.playersMaxOverride : m.max,
    recommendedMax: m.recommendedMax,
  };
};

// Join one entry + its plugin manifest → the public LandingGame shape. Returns null if the game
// isn't a registered plugin or has no UI mapping (defensive — never 500s the list).
const toPublicGame = (entry: CatalogueEntryDoc): PublicCatalogueGame | null => {
  const plugin = getPlugin(entry.gameId);
  const mapping = uiMappingFor(entry.gameId);
  if (!plugin || !mapping) {
    logger.warn({ gameId: entry.gameId }, 'catalogue: active entry skipped — unknown plugin or mapping');
    return null;
  }
  const players = effectivePlayers(plugin, entry);
  return {
    id: mapping.prdId,
    gameId: entry.gameId,
    key: mapping.key,
    category: mapping.uiCategory,
    mode: plugin.manifest.mode,
    title: plugin.manifest.title,
    description: entry.description,
    estMinutes: entry.estMinutes,
    players,
    meta: formatMeta(players.min, players.max, players.recommendedMax, entry.estMinutes),
    iconName: entry.iconName,
  };
};

// An admin authoring row: the entry joined to live manifest fields + eligibility flags (spec §3.4).
export interface AdminCatalogueRow {
  gameId: string;
  hasEntry: boolean;
  eligible: boolean; // registered plugin → playable
  status: Status | null;
  // live manifest fields (source of truth)
  title: string | null;
  category: string | null; // engine category value
  mode: string | null;
  manifestPlayers: { min: number; max: number | null; recommendedMax: number } | null;
  // admin-authored entry (null when no entry yet)
  entry: CatalogueEntryDoc | null;
}

export class CatalogueService {
  // ── Public ────────────────────────────────────────────────────────────────

  // Active games, joined + translated + ordered. The drop-in replacement for the static GAMES array.
  async listActive(): Promise<ServiceResult<PublicCatalogueGame[]>> {
    const entries = await catalogueRepository.listActive();
    const games = entries.map(toPublicGame).filter((g): g is PublicCatalogueGame => g !== null);
    return ServiceSuccess(games);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  // Every registered plugin joined to its entry (if any) — the authoring/eligibility view.
  async listForAdmin(): Promise<ServiceResult<AdminCatalogueRow[]>> {
    const entries = await catalogueRepository.listAll();
    const byGameId = new Map(entries.map((e) => [e.gameId, e]));
    const eligible = listPlugins().filter((p) => uiMappingFor(p.manifest.id) !== undefined);

    const rows: AdminCatalogueRow[] = eligible.map((plugin) => {
      const entry = byGameId.get(plugin.manifest.id) ?? null;
      return {
        gameId: plugin.manifest.id,
        hasEntry: entry !== null,
        eligible: true,
        status: entry?.status ?? null,
        title: plugin.manifest.title,
        category: plugin.manifest.category,
        mode: plugin.manifest.mode,
        manifestPlayers: plugin.manifest.players,
        entry,
      };
    });
    return ServiceSuccess(rows);
  }

  async getByGameId(gameId: string): Promise<ServiceResult<CatalogueEntryDoc>> {
    const entry = await catalogueRepository.getByGameId(gameId);
    if (!entry) {
      return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.catalogue.NOT_FOUND, 404);
    }
    return ServiceSuccess(entry);
  }

  async create(input: CreateCatalogueInput): Promise<ServiceResult<CatalogueEntryDoc>> {
    // gameId must be a registered, mappable game (not a test game / unknown id).
    if (!getPlugin(input.gameId) || !uiMappingFor(input.gameId)) {
      return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.catalogue.INVALID_GAME, 422, {
        gameId: ['Not a registered, catalogable game.'],
      });
    }
    if (await catalogueRepository.getByGameId(input.gameId)) {
      return ServiceError(ERROR_CODES.CATALOGUE_ENTRY_EXISTS, MESSAGE_KEYS.catalogue.ALREADY_EXISTS, 409);
    }

    const mapping = uiMappingFor(input.gameId);
    const repoInput: CatalogueEntryInput = {
      gameId: input.gameId,
      description: input.description,
      estMinutes: input.estMinutes,
      iconName: input.iconName,
      // default sortOrder to the PRD id so the showcase order matches the manifest out of the box.
      sortOrder: input.sortOrder ?? mapping?.prdId ?? 0,
      ...(input.playersMinOverride !== undefined && { playersMinOverride: input.playersMinOverride }),
      ...(input.playersMaxOverride !== undefined && { playersMaxOverride: input.playersMaxOverride }),
    };
    const entry = await catalogueRepository.create(repoInput);
    return ServiceSuccess(entry);
  }

  async update(gameId: string, patch: UpdateCatalogueInput): Promise<ServiceResult<CatalogueEntryDoc>> {
    // exactOptionalPropertyTypes: only forward keys actually present in the patch.
    const clean: Partial<CatalogueEntryInput> = {
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.estMinutes !== undefined && { estMinutes: patch.estMinutes }),
      ...(patch.iconName !== undefined && { iconName: patch.iconName }),
      ...(patch.playersMinOverride !== undefined && { playersMinOverride: patch.playersMinOverride }),
      ...(patch.playersMaxOverride !== undefined && { playersMaxOverride: patch.playersMaxOverride }),
      ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
    };
    const entry = await catalogueRepository.update(gameId, clean);
    if (!entry) {
      return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.catalogue.NOT_FOUND, 404);
    }
    return ServiceSuccess(entry);
  }

  async activate(gameId: string): Promise<ServiceResult<CatalogueEntryDoc>> {
    return this.setStatus(gameId, CatalogueStatus.ACTIVE);
  }

  async deactivate(gameId: string): Promise<ServiceResult<CatalogueEntryDoc>> {
    return this.setStatus(gameId, CatalogueStatus.INACTIVE);
  }

  private async setStatus(gameId: string, status: Status): Promise<ServiceResult<CatalogueEntryDoc>> {
    const entry = await catalogueRepository.setStatus(gameId, status);
    if (!entry) {
      return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.catalogue.NOT_FOUND, 404);
    }
    return ServiceSuccess(entry);
  }

  async remove(gameId: string): Promise<ServiceResult<{ gameId: string }>> {
    const removed = await catalogueRepository.remove(gameId);
    if (!removed) {
      return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.catalogue.NOT_FOUND, 404);
    }
    return ServiceSuccess({ gameId });
  }
}

export const catalogueService = new CatalogueService();
