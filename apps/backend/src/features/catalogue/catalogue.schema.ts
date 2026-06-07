import { z } from 'zod';

import { UiCategory } from './catalogue.constants';

// Zod schemas for the catalogue feature. The upsert schema validates admin-authored presentation
// fields at the service boundary (→ 422 with field_errors). The public response schema is the
// contract at the seam — the landing showcase's LandingGame shape (the backend emits exactly this).

// ── Admin upsert (create body / patch body) ──────────────────────────────────

export const createCatalogueSchema = z.object({
  gameId: z.string().min(1), // existence vs the plugin registry checked in the service
  description: z.string().min(1).max(280),
  estMinutes: z.number().int().positive().max(120),
  iconName: z.string().min(1),
  playersMinOverride: z.number().int().positive().optional(),
  playersMaxOverride: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type CreateCatalogueInput = z.infer<typeof createCatalogueSchema>;

// Patch: same fields minus gameId (the gameId is the path param / immutable join key), all optional.
export const updateCatalogueSchema = createCatalogueSchema.omit({ gameId: true }).partial();
export type UpdateCatalogueInput = z.infer<typeof updateCatalogueSchema>;

// ── Public response (the LandingGame contract — apps/game .../games-manifest.ts) ──

export const publicCatalogueGameSchema = z.object({
  id: z.number().int().positive(), // PRD numeric id
  gameId: z.string(), // engine id (extra context for start/routing)
  key: z.string(), // kebab GameKey the UI keys on
  category: z.nativeEnum(UiCategory),
  mode: z.string(), // engine GameMode value (extra context)
  title: z.string(),
  description: z.string(),
  estMinutes: z.number().int().positive(),
  players: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive().nullable(),
    recommendedMax: z.number().int().positive(),
  }),
  meta: z.string(), // server-formatted "2–10 · 7m"
  iconName: z.string(),
});
export type PublicCatalogueGame = z.infer<typeof publicCatalogueGameSchema>;

export const publicCatalogueResponseSchema = z.object({
  data: z.array(publicCatalogueGameSchema),
});
