import { InvSoloService, normalizeConfig, scoreAccusation } from './inv-solo.service';

// Client-driven solo Investigation — correctness. The scoring + flow are pure except start() which
// draws a case from the content service; we mock that so the suite is hermetic (no Mongo).

jest.mock('@features/content/content.service', () => ({
  contentService: {
    resolveInvestigationCases: jest.fn(async () => [
      {
        title: 'The Last Pour',
        category: 'Homicide',
        brief: 'A poisoning.',
        suspects: [{ id: 's1', name: 'Tunde' }, { id: 's3', name: 'Emeka' }],
        reports: [{ id: 'r2', kind: 'forensic', title: 'Scene' }],
        tools: [{ id: 'tool-id', name: 'Identity Lookup' }],
        solutionSuspectId: 's3',
        keyEvidenceId: 'r2',
        explanation: 'Emeka did it.',
      },
    ]),
  },
}));

describe('scoreAccusation', () => {
  it('wrong suspect scores 0', () => {
    expect(scoreAccusation(false, false, 'certain', 0, 300)).toBe(0);
  });
  it('right suspect, instant, key evidence, certain = max base*1.15 + bonus', () => {
    // base 800 (instant) * 1.15 + 200 = 1120
    expect(scoreAccusation(true, true, 'certain', 0, 300)).toBe(1120);
  });
  it('right suspect, full window, no evidence, solid = floor', () => {
    // base 400 (full window) * 1 + 0 = 400
    expect(scoreAccusation(true, false, 'solid', 300_000, 300)).toBe(400);
  });
  it('decays with elapsed time', () => {
    // half window → base 600 * 1 = 600
    expect(scoreAccusation(true, false, 'solid', 150_000, 300)).toBe(600);
  });
});

describe('normalizeConfig', () => {
  it('defaults + clamps', () => {
    expect(normalizeConfig({}).investigateSeconds).toBe(300);
    expect(normalizeConfig({ investigateSeconds: 5 }).investigateSeconds).toBe(30); // clamped to 30s floor
    expect(normalizeConfig({ investigateSeconds: 99999 }).investigateSeconds).toBe(3600);
  });

  it('reads caseKey (empty default)', () => {
    expect(normalizeConfig({}).caseKey).toBe('');
    expect(normalizeConfig({ caseKey: 'the-last-pour' }).caseKey).toBe('the-last-pour');
  });
});

describe('InvSoloService — flow', () => {
  const svc = (): InvSoloService => new InvSoloService();

  it('start serves the case WITHOUT the solution', async () => {
    const res = await svc().start({});
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.soloId).toBeTruthy();
    const json = JSON.stringify(res.data.theCase);
    expect(json).not.toContain('solutionSuspectId');
    expect(json).not.toContain('Emeka did it'); // explanation withheld
    expect(Array.isArray(res.data.theCase.tools)).toBe(true);
  });

  it('a correct, evidence-backed, certain accusation scores and reveals', async () => {
    const s = svc();
    const start = await s.start({});
    if (!start.success) throw new Error('start failed');
    const r = s.accuse(start.data.soloId, 's3', 'r2', 'certain', 0);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.correct).toBe(true);
    expect(r.data.correctEvidence).toBe(true);
    expect(r.data.points).toBe(1120);
    expect(r.data.solutionSuspectId).toBe('s3');
    expect(r.data.explanation).toBe('Emeka did it.');
  });

  it('a wrong accusation scores 0 but still reveals', async () => {
    const s = svc();
    const start = await s.start({});
    if (!start.success) throw new Error('start failed');
    const r = s.accuse(start.data.soloId, 's1', '', 'hunch', 1000);
    expect(r.success && r.data.correct).toBe(false);
    expect(r.success && r.data.points).toBe(0);
    expect(r.success && r.data.solutionSuspectId).toBe('s3');
  });

  it('a second accusation is rejected (one shot)', async () => {
    const s = svc();
    const start = await s.start({});
    if (!start.success) throw new Error('start failed');
    s.accuse(start.data.soloId, 's3', 'r2', 'solid', 0);
    const again = s.accuse(start.data.soloId, 's1', '', 'solid', 0);
    expect(again.success).toBe(false);
    if (again.success) return;
    expect(again.errorCode).toBe('conflict');
  });

  it('empty suspect → 422; unknown soloId → 404', async () => {
    const s = svc();
    const start = await s.start({});
    if (!start.success) throw new Error('start failed');
    expect(s.accuse(start.data.soloId, '', '', 'solid', 0).success).toBe(false);
    expect(s.accuse('nope', 's3', 'r2', 'solid', 0).success).toBe(false);
    expect(s.snapshot('nope').success).toBe(false);
  });
});
