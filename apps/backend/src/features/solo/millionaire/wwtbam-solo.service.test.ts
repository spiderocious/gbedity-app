import { WwtbamSoloService, normalizeConfig, LADDER } from './wwtbam-solo.service';

// Client-driven solo WWTBAM — correctness tests. Only `start()` touches Mongo, so we mock
// contentService so the suite is hermetic (no Mongo, no flake). Pure pieces (config normalization,
// the question/answer/next state machine, 50/50, timeout) tested against a deterministic session.

const MOCK_QUESTIONS = [
  { prompt: 'Q1?', options: ['A', 'B', 'C', 'D'], answerIdx: 1 },
  { prompt: 'Q2?', options: ['W', 'X', 'Y', 'Z'], answerIdx: 2 },
  { prompt: 'Q3?', options: ['P', 'Q', 'R', 'S'], answerIdx: 0 },
];

jest.mock('@features/content/content.service', () => ({
  contentService: {
    resolveQuizQuestions: jest.fn(async ({ sample }: { sample: number }) =>
      MOCK_QUESTIONS.slice(0, sample),
    ),
  },
}));

describe('normalizeConfig', () => {
  it('fills defaults from an empty object', () => {
    expect(normalizeConfig({})).toEqual({ questionCount: 10, secondsPerQuestion: 30, category: 'general' });
  });

  it('clamps questionCount to ladder length', () => {
    expect(normalizeConfig({ questionCount: 999 }).questionCount).toBe(LADDER.length);
  });

  it('clamps secondsPerQuestion', () => {
    expect(normalizeConfig({ secondsPerQuestion: 1 }).secondsPerQuestion).toBe(5);
    expect(normalizeConfig({ secondsPerQuestion: 999 }).secondsPerQuestion).toBe(120);
  });

  it('uses provided category', () => {
    expect(normalizeConfig({ category: 'sports' }).category).toBe('sports');
  });

  it('falls back to general for empty/non-string category', () => {
    expect(normalizeConfig({ category: '' }).category).toBe('general');
    expect(normalizeConfig({ category: 42 }).category).toBe('general');
  });

  it('ignores garbage input', () => {
    expect(normalizeConfig(null)).toEqual({ questionCount: 10, secondsPerQuestion: 30, category: 'general' });
    expect(normalizeConfig('bad')).toEqual({ questionCount: 10, secondsPerQuestion: 30, category: 'general' });
  });
});

describe('WwtbamSoloService — full client-driven flow', () => {
  const svc = (): WwtbamSoloService => new WwtbamSoloService();

  it('start returns soloId + ladder and keeps answers secret', async () => {
    const res = await svc().start({ questionCount: 3 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.soloId).toBeTruthy();
    expect(res.data.questionCount).toBe(3);
    expect(res.data.ladder).toEqual(LADDER);
    // Answers must never appear in the start payload.
    expect(JSON.stringify(res.data)).not.toContain('answerIdx');
  });

  it('question returns prompt + options with answer withheld', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const q = s.question(start.data.soloId);
    expect(q.success).toBe(true);
    if (!q.success) return;
    expect(q.data.idx).toBe(0);
    expect(q.data.prompt).toBe('Q1?');
    expect(q.data.options).toHaveLength(4);
    expect(q.data.rung).toBe(LADDER[0]);
    expect(q.data.fiftyFiftyAvailable).toBe(true);
    // answer not revealed
    expect(JSON.stringify(q.data)).not.toContain('answerIdx');
  });

  it('question is idempotent — safe to call twice for the same question', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    const a = s.question(id);
    const b = s.question(id);
    expect(a.success && b.success && a.data.idx).toBe(b.success && b.data.idx);
  });

  it('a correct answer banks the rung value and does not eliminate', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    // Q1 answerIdx=1, rung=LADDER[0]=100
    const res = s.answer(id, 1);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.correct).toBe(true);
    expect(res.data.answerIdx).toBe(1);
    expect(res.data.rung).toBe(LADDER[0]);
    expect(res.data.bankedThisQuestion).toBe(LADDER[0]);
    expect(res.data.totalBanked).toBe(LADDER[0]);
    expect(res.data.eliminated).toBe(false);
  });

  it('a wrong answer scores 0 and eliminates the player', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    const res = s.answer(id, 0); // wrong — Q1 correct is 1
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.correct).toBe(false);
    expect(res.data.bankedThisQuestion).toBe(0);
    expect(res.data.eliminated).toBe(true);
  });

  it('a second answer on the same question is rejected (already answered)', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 1);
    const again = s.answer(id, 1);
    expect(again.success).toBe(false);
    if (again.success) return;
    expect(again.errorCode).toBe('conflict');
  });

  it('timeout answer scores 0 and eliminates even if text matches', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    // timeout=true with the correct index — still scores 0 and eliminates
    const res = s.answer(id, 1, true);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.correct).toBe(false);
    expect(res.data.bankedThisQuestion).toBe(0);
    expect(res.data.eliminated).toBe(true);
  });

  it('next advances to the next question when previous was answered correctly', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 1); // correct Q1
    const n = s.next(id);
    expect(n.success).toBe(true);
    if (!n.success) return;
    expect(n.data.done).toBe(false);
    expect(n.data.idx).toBe(1);
  });

  it('next after wrong answer returns done:true immediately', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 0); // wrong
    const n = s.next(id);
    expect(n.success && n.data.done).toBe(true);
    expect(n.success && n.data.eliminated).toBe(true);
  });

  it('next without answering auto-eliminates (client-side timeout missed /answer)', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    // Skip /answer entirely — call /next directly
    const n = s.next(id);
    expect(n.success && n.data.done).toBe(true);
    expect(n.success && n.data.eliminated).toBe(true);
  });

  it('ends with done:true after all questions answered correctly', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    // Q1 correct idx=1, Q2 correct idx=2, Q3 correct idx=0
    s.answer(id, 1); s.next(id);
    s.answer(id, 2); s.next(id);
    const last = s.answer(id, 0);
    expect(last.success && last.data.correct).toBe(true);
    const n = s.next(id);
    expect(n.success && n.data.done).toBe(true);
    expect(n.success && n.data.eliminated).toBe(false);
    expect(n.success && n.data.totalBanked).toBe(LADDER[0]! + LADDER[1]! + LADDER[2]!);
  });

  it('question/answer after game is over returns 409', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 1 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 1); // correct
    s.next(id); // done
    const q = s.question(id);
    expect(q.success).toBe(false);
    if (q.success) return;
    expect(q.httpStatus).toBe(409);
  });

  it('fifty-fifty returns two wrong indices and marks lifeline used', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    const ff = s.fiftyFifty(id);
    expect(ff.success).toBe(true);
    if (!ff.success) return;
    const { hidden } = ff.data;
    expect(hidden).toHaveLength(2);
    // Neither hidden index should be the correct answer (Q1 answerIdx=1).
    expect(hidden).not.toContain(1);
    // Reusing is rejected.
    const again = s.fiftyFifty(id);
    expect(again.success).toBe(false);
    if (again.success) return;
    expect(again.errorCode).toBe('conflict');
  });

  it('fifty-fifty after answering the current question is rejected', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 1);
    const ff = s.fiftyFifty(id);
    expect(ff.success).toBe(false);
  });

  it('snapshot reflects progress', async () => {
    const s = svc();
    const start = await s.start({ questionCount: 3 });
    if (!start.success) throw new Error('start failed');
    const id = start.data.soloId;
    s.answer(id, 1); // correct Q1
    s.next(id);
    const snap = s.snapshot(id);
    expect(snap.success).toBe(true);
    if (!snap.success) return;
    expect(snap.data.idx).toBe(1);
    expect(snap.data.totalBanked).toBe(LADDER[0]);
    expect(snap.data.eliminated).toBe(false);
    expect(snap.data.over).toBe(false);
  });

  it('returns solo_not_found for an unknown soloId', () => {
    const s = svc();
    expect(s.question('nope').success).toBe(false);
    expect(s.answer('nope', 0).success).toBe(false);
    expect(s.next('nope').success).toBe(false);
    expect(s.snapshot('nope').success).toBe(false);
    expect(s.fiftyFifty('nope').success).toBe(false);
  });
});
