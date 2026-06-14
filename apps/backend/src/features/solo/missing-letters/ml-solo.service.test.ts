import { MlSoloService, normalizeConfig, scoreGuess } from './ml-solo.service';

// Client-driven solo Missing Letters — correctness tests. The pure pieces (scoring, config
// normalization, the round/guess/next state machine) need no DB; only `start()` touches Mongo, so
// we drive the machine by seeding a session through start() with a tiny stubbed word pick (we mock
// the picker so the suite is hermetic — no Mongo, no flake).

// Stub the word picker so start() is deterministic and DB-free.
jest.mock('@games/shared/word-picker', () => ({
  pickGameWords: jest.fn(async ({ count }: { count: number }) =>
    ['banana', 'orange', 'pencil', 'guitar', 'planet', 'rocket', 'silver', 'tomato'].slice(0, count),
  ),
}));

describe('scoreGuess (speed-weighted)', () => {
  it('awards 0 for a wrong guess regardless of speed', () => {
    expect(scoreGuess(false, 0, 20)).toBe(0);
    expect(scoreGuess(false, 20_000, 20)).toBe(0);
  });

  it('awards MAX for an instant correct guess', () => {
    expect(scoreGuess(true, 0, 20)).toBe(1000);
  });

  it('awards FLOOR for a correct guess at/after the deadline', () => {
    expect(scoreGuess(true, 20_000, 20)).toBe(400);
    expect(scoreGuess(true, 99_000, 20)).toBe(400); // clamped past the window
  });

  it('decays linearly between MAX and FLOOR', () => {
    // Half the window used → halfway between 1000 and 400 = 700.
    expect(scoreGuess(true, 10_000, 20)).toBe(700);
  });

  it('treats negative elapsed as instant (clamped to 0)', () => {
    expect(scoreGuess(true, -500, 20)).toBe(1000);
  });
});

describe('normalizeConfig (untrusted input → clamped)', () => {
  it('fills defaults from an empty object', () => {
    expect(normalizeConfig({})).toEqual({ rounds: 8, secondsPerRound: 20, hiddenCount: 2, minLen: 4, maxLen: 8 });
  });

  it('clamps out-of-range values', () => {
    const c = normalizeConfig({ rounds: 999, secondsPerRound: 1, hiddenCount: 9, minLen: 1, maxLen: 99 });
    expect(c.rounds).toBe(20);
    expect(c.secondsPerRound).toBe(5);
    expect(c.hiddenCount).toBe(3);
    expect(c.minLen).toBe(3);
    expect(c.maxLen).toBe(14);
  });

  it('keeps maxLen >= minLen', () => {
    const c = normalizeConfig({ minLen: 8, maxLen: 4 });
    expect(c.maxLen).toBeGreaterThanOrEqual(c.minLen);
  });

  it('ignores garbage input', () => {
    expect(normalizeConfig(null)).toEqual({ rounds: 8, secondsPerRound: 20, hiddenCount: 2, minLen: 4, maxLen: 8 });
    expect(normalizeConfig('nope')).toEqual({ rounds: 8, secondsPerRound: 20, hiddenCount: 2, minLen: 4, maxLen: 8 });
  });
});

describe('MlSoloService — full client-driven flow', () => {
  const svc = (): MlSoloService => new MlSoloService();

  it('start picks words, returns rounds, and hides answers', async () => {
    const res = await svc().start({ rounds: 4 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.rounds).toBe(4);
    expect(res.data.soloId).toBeTruthy();
    // The start payload carries NO words/answers.
    expect(JSON.stringify(res.data)).not.toContain('banana');
  });

  it('round returns a masked word with the answer withheld', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4, hiddenCount: 2 });
    if (!start.success) throw new Error('start failed');
    const r = s.round(start.data.soloId);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.idx).toBe(0);
    expect(r.data.rounds).toBe(4);
    expect(r.data.length).toBe(6); // banana
    expect(r.data.masked).toContain('_'); // at least one blank
    expect(r.data.masked).not.toContain('banana');
    // First letter always visible (solvability).
    expect(r.data.masked.startsWith('b')).toBe(true);
    expect(r.data.secondsPerRound).toBe(20);
  });

  it('a correct guess scores, reveals the answer, and accumulates total', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    s.round(start.data.soloId);
    const g = s.guess(start.data.soloId, 'BANANA', 0); // case-insensitive, instant
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(true);
    expect(g.data.points).toBe(1000);
    expect(g.data.answer).toBe('banana');
    expect(g.data.totalScore).toBe(1000);
  });

  it('a wrong guess scores 0 but still reveals the answer and locks the round', async () => {
    const s = svc();
    const start = await s.start({ rounds: 4 });
    if (!start.success) throw new Error('start failed');
    const g = s.guess(start.data.soloId, 'wrongword', 3000);
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(false);
    expect(g.data.points).toBe(0);
    expect(g.data.answer).toBe('banana');
    // Second guess on the same round is rejected (already answered/locked).
    const again = s.guess(start.data.soloId, 'banana', 0);
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
    s.guess(id, 'banana', 0);
    const n1 = s.next(id);
    expect(n1.success && n1.data.done).toBe(false);
    expect(n1.success && n1.data.idx).toBe(1);
    // Round 1
    s.round(id);
    s.guess(id, 'orange', 0);
    const n2 = s.next(id);
    expect(n2.success && n2.data.done).toBe(true);
    // Round calls after over are rejected.
    const after = s.round(id);
    expect(after.success).toBe(false);
  });

  it('skipping a round without guessing counts as a 0 (timeout) and still advances', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    const n = s.next(id); // never guessed round 0
    expect(n.success && n.data.idx).toBe(1);
    expect(n.success && n.data.totalScore).toBe(0);
  });

  it('accepts an empty guess as a timeout (0 points, reveals the answer)', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    s.round(start.data.soloId);
    const g = s.guess(start.data.soloId, '', 20_000, true);
    expect(g.success).toBe(true);
    if (!g.success) return;
    expect(g.data.correct).toBe(false);
    expect(g.data.points).toBe(0);
    expect(g.data.answer).toBe('banana'); // revealed
  });

  it('a timeout never scores even if the text matches', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    s.round(start.data.soloId);
    const g = s.guess(start.data.soloId, 'banana', 0, true);
    expect(g.success && g.data.correct).toBe(false);
    expect(g.success && g.data.points).toBe(0);
  });

  it('rejects an empty guess with a validation error', async () => {
    const s = svc();
    const start = await s.start({ rounds: 2 });
    if (!start.success) throw new Error('start failed');
    const g = s.guess(start.data.soloId, '   ', 0);
    expect(g.success).toBe(false);
    if (g.success) return;
    expect(g.errorCode).toBe('validation_error');
  });

  it('returns solo_not_found for an unknown soloId', () => {
    const s = svc();
    expect(s.round('nope').success).toBe(false);
    expect(s.guess('nope', 'x', 0).success).toBe(false);
    expect(s.next('nope').success).toBe(false);
    expect(s.snapshot('nope').success).toBe(false);
  });

  it('snapshot reflects progress', async () => {
    const s = svc();
    const start = await s.start({ rounds: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.round(id);
    s.guess(id, 'banana', 0);
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
