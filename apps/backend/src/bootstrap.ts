import { bootstrapEngine } from '@engine/index';
import { registerGames } from '@games/index';
import { installValidationProvider } from '@features/validation/validation.provider';
import { installPersistenceHook } from '@features/game-plays/persistence.provider';
import { installAIProvider } from '@features/ai/ai.provider';
import { ensureAdminIndexes } from '@features/admin/index';
import { ensureHostIndexes } from '@features/host/index';
import { ensureCatalogueIndexes } from '@features/catalogue/index';
import { seedCatalogue } from '@features/catalogue/catalogue.seed';

// Single composition root: installs the feature implementations into the engine's injected seams
// (validation, AI, persistence), registers all game plugins + content resolvers, ensures indexes.
// Keeps the engine free of @features imports (layering). Call once at server boot, after DB connects.

export const bootstrapApp = async (): Promise<void> => {
  bootstrapEngine(); // engine test games + constants
  registerGames(); // real catalogue games + content resolvers
  installValidationProvider();
  installAIProvider();
  await installPersistenceHook(); // ensures game-play indexes
  await ensureAdminIndexes();
  await ensureHostIndexes();
  await ensureCatalogueIndexes();
  await seedCatalogue(); // idempotent — seeds draft entries mirroring the static manifest (after games register)
};
