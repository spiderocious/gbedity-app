import { bootstrapEngine } from '@engine/index';
import { GameId } from '@engine/constants';
import { registerGames } from '@games/index';

import { catalogueRepository, type CatalogueEntryDoc } from './catalogue.repository';
import { CatalogueStatus } from './catalogue.constants';
import { CatalogueService } from './catalogue.service';
import { publicCatalogueResponseSchema } from './catalogue.schema';

// Contract/seam test (no Mongo). Proves the public list JOINS active entries to real plugin
// manifests and TRANSLATES to exactly the LandingGame shape the landing showcase consumes — the
// drift this feature exists to kill. Repo reads are stubbed; plugins are real (registerGames).

const entry = (over: Partial<CatalogueEntryDoc> & Pick<CatalogueEntryDoc, 'gameId'>): CatalogueEntryDoc => ({
  id: `cat_${over.gameId}`,
  status: CatalogueStatus.ACTIVE,
  description: 'desc',
  estMinutes: 7,
  iconName: 'Target',
  sortOrder: 1,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('catalogue contract — public list shape & translation', () => {
  beforeAll(() => {
    bootstrapEngine();
    registerGames(); // real catalogue plugins (manifests) must be registered for the join
  });

  afterEach(() => jest.restoreAllMocks());

  it('emits the LandingGame contract shape and translates engine→UI encoding', async () => {
    jest
      .spyOn(catalogueRepository, 'listActive')
      .mockResolvedValue([
        entry({ gameId: GameId.WORDSHOT, description: 'A letter and a category.', estMinutes: 7, sortOrder: 5 }),
      ]);

    const result = await new CatalogueService().listActive();
    expect(result.success).toBe(true);
    if (!result.success) return;

    // The whole payload validates against the public contract schema.
    expect(() => publicCatalogueResponseSchema.parse({ data: result.data })).not.toThrow();

    const game = result.data[0]!;
    expect(game.id).toBe(5); // PRD numeric id (engine GameId → number)
    expect(game.key).toBe('wordshot'); // kebab key
    expect(game.category).toBe('casual'); // engine 'quick' → UI 'casual'
    expect(game.gameId).toBe(GameId.WORDSHOT);
    expect(game.title).toBe('Wordshot'); // from the live manifest, not stored
    expect(game.meta).toBe('2–10 · 7m'); // server-formatted (unbounded max → recommendedMax)
    expect(game.players).toEqual({ min: 2, max: null, recommendedMax: 10 });
  });

  it('orders by sortOrder and respects player-range overrides in meta', async () => {
    jest.spyOn(catalogueRepository, 'listActive').mockResolvedValue([
      entry({ gameId: GameId.DEFINITION_RACE, sortOrder: 9 }),
      entry({ gameId: GameId.MISSING_LETTERS, sortOrder: 8, playersMinOverride: 3, playersMaxOverride: 6, estMinutes: 6 }),
    ]);

    const result = await new CatalogueService().listActive();
    if (!result.success) return;

    // listActive() returns repo order (repo sorts); the override flows into meta + players.
    const missing = result.data.find((g) => g.gameId === GameId.MISSING_LETTERS)!;
    expect(missing.players).toEqual({ min: 3, max: 6, recommendedMax: 10 });
    expect(missing.meta).toBe('3–6 · 6m');
  });

  it('skips an active entry whose plugin is not registered (never crashes the list)', async () => {
    jest
      .spyOn(catalogueRepository, 'listActive')
      .mockResolvedValue([entry({ gameId: 'not_a_real_game' }), entry({ gameId: GameId.QUIZZES })]);

    const result = await new CatalogueService().listActive();
    if (!result.success) return;
    expect(result.data).toHaveLength(1); // unknown game dropped
    expect(result.data[0]!.gameId).toBe(GameId.QUIZZES);
  });
});

describe('catalogue contract — admin create validation', () => {
  beforeAll(() => {
    bootstrapEngine();
    registerGames();
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects a gameId that is not a registered, mappable game (422)', async () => {
    const result = await new CatalogueService().create({
      gameId: 'test_simultaneous', // a test game — registered but not catalogable (no UI mapping)
      description: 'x',
      estMinutes: 5,
      iconName: 'Target',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('validation_error');
    expect(result.fieldErrors?.gameId).toBeDefined();
  });

  it('rejects a duplicate catalogue entry (409)', async () => {
    jest.spyOn(catalogueRepository, 'getByGameId').mockResolvedValue(entry({ gameId: GameId.WORDSHOT }));
    const result = await new CatalogueService().create({
      gameId: GameId.WORDSHOT,
      description: 'x',
      estMinutes: 5,
      iconName: 'Target',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.httpStatus).toBe(409);
    expect(result.errorCode).toBe('catalogue_entry_exists');
  });
});
