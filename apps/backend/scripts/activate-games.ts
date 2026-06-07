import { connectDb, closeDb } from '../src/db/client';
import { bootstrapApp } from '../src/bootstrap';
import { catalogueService } from '../src/features/catalogue/catalogue.service';
import { GameId } from '../src/engine/constants';

// One-shot: activate specific catalogue games through the real service path (same DB the server
// reads). bootstrapApp() registers plugins + runs the idempotent seed (drafts) first, so the
// entries exist to activate. Run: tsx --env-file=.env scripts/activate-games.ts <gameId...>

const DEFAULT = [GameId.MISSING_LETTERS, GameId.DEFINITION_RACE];

const main = async (): Promise<void> => {
  const ids = process.argv.slice(2);
  const targets = ids.length > 0 ? ids : DEFAULT;

  await connectDb();
  await bootstrapApp(); // registers games + ensures indexes + seeds draft entries (idempotent)

  for (const gameId of targets) {
    const result = await catalogueService.activate(gameId);
    if (result.success) {
      console.log(`activated: ${gameId} → status=${result.data.status}`);
    } else {
      console.error(`FAILED: ${gameId} → ${result.errorCode} (${result.httpStatus})`);
    }
  }

  // Verify via the public path (active-only join + translate).
  const list = await catalogueService.listActive();
  if (list.success) {
    console.log(`\npublic catalogue now has ${list.data.length} active game(s):`);
    for (const g of list.data) console.log(`  - [${g.id}] ${g.title} (${g.key}) · ${g.meta} · ${g.category}`);
  }

  await closeDb();
};

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
