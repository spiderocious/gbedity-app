// Single source of truth for backend admin paths (relative to API_BASE_URL, which already
// includes the /api/v1 prefix). Don't hand-write these in hooks — use EP. Parametric paths
// are functions. Mirrors apps/backend/src/features/admin/admin.routes.ts.
export const EP = {
  // Auth (public)
  ADMIN_SEED: '/admin/seed',
  ADMIN_LOGIN: '/admin/login',
  ADMIN_REFRESH: '/admin/refresh',

  // History + metrics
  GAME_PLAYS: '/admin/game-plays',
  GAME_PLAY: (id: string) => `/admin/game-plays/${id}`,
  SESSION_EVENTS: (instanceId: string) => `/admin/sessions/${instanceId}/events`,
  METRICS: '/admin/metrics',

  // Rubric
  RUBRIC: '/admin/rubric',

  // Content authoring (per kind)
  CONTENT: (kind: string) => `/admin/content/${kind}`,
  CONTENT_BULK: (kind: string) => `/admin/content/${kind}/bulk`,
  CONTENT_ITEM: (kind: string, id: string) => `/admin/content/${kind}/${id}`,

  // Catalogue authoring + curation
  CATALOGUE: '/admin/catalogue',
  CATALOGUE_ENTRY: (gameId: string) => `/admin/catalogue/${gameId}`,
  CATALOGUE_ACTIVATE: (gameId: string) => `/admin/catalogue/${gameId}/activate`,
  CATALOGUE_DEACTIVATE: (gameId: string) => `/admin/catalogue/${gameId}/deactivate`,

  // Word bank — reference browse + operational sets
  WORD_SOURCE: (source: string) => `/admin/word-sources/${source}`,
  GAME_WORDS: '/admin/game-words',
  GAME_WORDS_PROMOTE: '/admin/game-words/promote',
  GAME_WORD: (id: string) => `/admin/game-words/${id}`,
  GAME_DEFINITIONS: '/admin/game-definitions',
  GAME_DEFINITIONS_PROMOTE: '/admin/game-definitions/promote',
  GAME_DEFINITION: (id: string) => `/admin/game-definitions/${id}`,
} as const;
