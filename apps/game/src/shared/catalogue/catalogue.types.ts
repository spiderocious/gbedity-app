import { z } from 'zod';

// The catalogue contract — the public shape GET /api/v1/catalogue returns (backend spec:
// docs/backend/specs/game-catalogue.md §3.1). Parsed in the queryFn — never trust the wire.
// This REPLACES the static LandingGame as the runtime catalogue type. The backend does all
// engine→UI translation, so this is already the UI's encoding (numeric id, kebab key, casual
// category, server-formatted meta, plus each game's own backend `gameId` for starting it).

export const CatalogueCategory = z.enum(['casual', 'brain', 'party', 'immersive']);
export type CatalogueCategory = z.infer<typeof CatalogueCategory>;

export const CatalogueGame = z.object({
  id: z.number(), // PRD numeric id (display + routing)
  gameId: z.string(), // engine id — the value POST /rooms/:code/start expects
  key: z.string(), // kebab GameKey
  category: CatalogueCategory,
  mode: z.string(),
  title: z.string(),
  description: z.string(),
  estMinutes: z.number(),
  players: z.object({
    min: z.number(),
    max: z.number().nullable(),
    recommendedMax: z.number(),
  }),
  meta: z.string(), // server-formatted "2–10 · 7m"
  iconName: z.string(), // lucide icon name → resolved via catalogue-icon.ts
});
export type CatalogueGame = z.infer<typeof CatalogueGame>;

export const CatalogueResponse = z.array(CatalogueGame);
