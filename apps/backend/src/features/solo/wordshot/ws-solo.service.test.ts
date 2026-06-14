import { WsSoloService, normalizeConfig, scoreGuess } from './ws-solo.service';

// Client-driven solo Wordshot — correctness tests. The pure pieces (scoring, config normalization,
// the round/guess/next state machine) need no DB; only `start()` touches Mongo (contentService) and
// `guess()` touches validationService. Both are mocked so the suite is hermetic.

jest.mock('@features/content/content.service', () => ({
  contentService: {
    wordCategories: jest.fn(async () => ['animal', 'food', 'name', 'city', 'country']),
    wordCount: jest.fn(async () => 5), // every (letter, category) pair is non-empty
  },
}));

jest.mock('@features/validation/validation.service', () => ({
  DupHandling: { STRICT: 'strict', RELAXED: 'relaxed', SYNONYM: 'synonym' },
  validationService: {
    validateWord: jest.fn(async ({ word }: { word: string }) => ({
      valid: word === 'antelope', // only 'antelope' passes validation in tests
      level: word === 'antelope' ? 1 : 0,
      isRealWord: word === 'antelope',
      fitsCategory: word === 'antelope',
      correctLetter: true,
      isDuplicate: false,
      confidence: word === 'antelope' ? 1 : 0,
      score: word === 'antelope' ? 100 : 0,
      suggestion: word !== 'antelope' ? 'antelope' : undefined,
    })),
  },
}));

describe('scoreGuess (speed-weighted)', () => {
  it('awards 0 for a wrong guess regardless of speed', () => {
    expect(scoreGuess(false, 0, 20)).toBe(0);
    expect(scoreGuess(false, 20_000, 20)).toBe(0);
  });

  it('awards MAX (1000) for an instant correct guess', () => {
    expect(scoreGuess(true, 0, 20)).toBe(1000);
  });

  it('awards FLOOR (500) for a correct guess at/after the deadline', () => {
    expect(scoreGuess(true, 20_000, 20)).toBe(500);
    expect(scoreGuess(true, 99_000, 20)).toBe(500); // clamped past the window
  });

  it('decays linearly between MAX and FLOOR', () => {
    // Half the window used → halfway between 1000 and 500 = 750.
    expect(scoreGuess(true, 10_000, 20)).toBe(750);
  });

  it('treats negative elapsed as instant (clamped to 0)', () => {
    expect(scoreGuess(true, -500, 20)).toBe(1000);
  });
});

describe('normalizeConfig (untrusted input → clamped)', () => {
  it('fills defaults from an empty object', () => {
    expect(normalizeConfig({})).toEqual({
      rounds: 10,
      secondsPerRound: 20,
      letterDifficulty: 'mixed',
      enabledCategories: [],
    });
  });

  it('clamps out-of-range values', () => {
    const c = normalizeConfig({ rounds: 999, secondsPerRound: 1 });
    expect(c.rounds).toBe(20);
    expect(c.secondsPerRound).toBe(5);
  });

  it('accepts valid letterDifficulty values', () => {
    expect(normalizeConfig({ letterDifficulty: 'common_only' }).letterDifficulty).toBe('common_only');
    expect(normalizeConfig({ letterDifficulty: 'includes_qxz' }).letterDifficulty).toBe('includes_qxz');
  });

  it('falls back to mixed for unknown letterDifficulty', () => {
    expect(normalizeConfig({ letterDifficulty: 'garbage' }).letterDifficulty).toBe('mixed');
  });

  it('filters non-string values from enabledCategories', () => {
    expect(normalizeConfig({ enabledCategories: ['animal', 42, null, 'food'] }).enabledCategories).toEqual(['animal', 'food']);
  });

  it('ignores garbage input', () => {
    const defaults = normalizeConfig(null);
    expect(defaults.rounds).toBe(10);
    expect(defaults.secondsPerRound).toBe(20);
  });
});

describe('WsSoloService — full client-driven flow', () => {
  const svc = (): WsSoloService => new WsSoloService();

  it('start resolves a round plan and returns rounds + soloId', async () => {
    const res = await svc().start({ rounds: 4 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.rounds).toBe(4);
    expect(res.data.soloId).toBeTruthy();
    // Start payload must NOT contain the full plan (no answers to leak, but also no letter/category
    // before round is called). The rounds count is enough for the client.
    expect(Object.keys(res.data)).toEqual(expect.arrayContaining(['soloId', 'rounds', 'config']));
  });

  it('round returns letter + category (answer withheld — there is none to hide, but plan is server-side)', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    const r = s.round(start.data.soloId);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.idx).toBe(0);
    expect(r.data.rounds).toBe(4);
    expect(typeof r.data.letter).toBe('string');
    expect(typeof r.data.category).toBe('string');
    expect(r.data.secondsPerRound).toBe(20);
  });

  it('round is idempotent — calling it twice returns the same round', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    const r1 = s.round(id);
    const r2 = s.round(id);
    expect(r1.success && r2.success && r1.data.letter).toBe(r2.success && r2.data.letter);
    expect(r1.success && r2.success && r1.data.category).toBe(r2.success && r2.data.category);
  });

  it('a correct guess (validation passes) scores and accumulates total', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    const g = await s.guess(id, 'antelope', 0); // mock: 'antelope' → valid:true
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(true);
    expect(g.data.points).toBe(1000); // instant → MAX
    expect(g.data.totalScore).toBe(1000);
  });

  it('a wrong guess scores 0 and returns a suggestion, then locks the round', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    const g = await s.guess(id, 'wrongword', 3000);
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(false);
    expect(g.data.points).toBe(0);
    expect(g.data.suggestion).toBe('antelope'); // from mock

    // Second guess on same round → rejected.
    const again = await s.guess(id, 'antelope', 0);
    expect(again.success).toBe(false);
    if (again.success) return;
    expect(again.errorCode).toBe('conflict');
  });

  it('next advances rounds and ends after the last round', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    // Round 0
    s.round(id);
    await s.guess(id, 'antelope', 0);
    const n1 = s.next(id);
    expect(n1.success && n1.data.done).toBe(false);
    expect(n1.success && n1.data.idx).toBe(1);
    // Round 1
    s.round(id);
    await s.guess(id, 'antelope', 0);
    const n2 = s.next(id);
    expect(n2.success && n2.data.done).toBe(true);
    // Round + guess after over are rejected.
    const afterRound = s.round(id);
    expect(afterRound.success).toBe(false);
    const afterGuess = await s.guess(id, 'antelope', 0);
    expect(afterGuess.success).toBe(false);
  });

  it('skipping a round without guessing counts as 0 (timeout) and still advances', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    const n = s.next(id); // never guessed round 0
    expect(n.success && n.data.idx).toBe(1);
    expect(n.success && n.data.totalScore).toBe(0);
  });

  it('accepts an empty guess as a timeout (0 points, no validation call)', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    s.round(start.data.soloId);
    const g = await s.guess(start.data.soloId, '', 20_000, true);
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(false);
    expect(g.data.points).toBe(0);
  });

  it('a timeout never scores even if the text would have been valid', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    s.round(start.data.soloId);
    const g = await s.guess(start.data.soloId, 'antelope', 0, true);
    expect(g.success && g.data.correct).toBe(false);
    expect(g.success && g.data.points).toBe(0);
  });

  it('rejects an empty non-timeout guess with a validation error', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    const g = await s.guess(start.data.soloId, '   ', 0);
    expect(g.success).toBe(false);
    if (g.success) return;
    expect(g.errorCode).toBe('validation_error');
  });

  it('returns solo_not_found for an unknown soloId', async () => {
    const s = svc();
    expect(s.round('nope').success).toBe(false);
    expect((await s.guess('nope', 'x', 0)).success).toBe(false);
    expect(s.next('nope').success).toBe(false);
    expect(s.snapshot('nope').success).toBe(false);
  });

  it('snapshot reflects progress', async () => {
    const s = svc();
    const start = await s.start({ rounds: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    await s.guess(id, 'antelope', 0);
    s.next(id);
    const snap = s.snapshot(id);
    expect(snap.success).toBe(true);
    if (!snap.success) return;
    expect(snap.data.idx).toBe(1);
    expect(snap.data.rounds).toBe(3);
    expect(snap.data.totalScore).toBe(1000);
    expect(snap.data.over).toBe(false);
  });
});
