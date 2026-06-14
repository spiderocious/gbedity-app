import { ActorRole, AudienceKind } from '@engine/constants';
import type { ActionCtx, InitInput, PlayerRef, TickCtx } from '@engine/types';
import type { EpochMs } from '@shared/time';

import { investigationGame } from './investigation.plugin';

// Investigation plugin behaviour: secrecy (the solution/explanation withheld until reveal), the
// reasoned-accusation lock + revise, EARLY ADVANCE when every player has locked in, and the
// reasoned scoring (right suspect speed-graded + key-evidence bonus + confidence). Driven through
// the pure step functions — no runtime/timers needed.

const players: PlayerRef[] = [
  { id: 'a', nickname: 'Ada' },
  { id: 'b', nickname: 'Ben' },
];

const content = investigationGame.contentSchema.parse({
  title: 'The Last Pour',
  category: 'Homicide',
  brief: 'A poisoning at a retirement dinner.',
  suspects: [
    { id: 's1', name: 'Tunde', age: 34, role: 'Son', motive: 'Cut from the will.', alibi: 'Drove home.' },
    { id: 's3', name: 'Emeka', age: 47, role: 'Partner', motive: 'Owed a debt.', alibi: 'Dubai call.' },
  ],
  reports: [{ id: 'r2', kind: 'forensic', title: 'Scene Report', findings: [{ heading: 'Glass', detail: 'Poison in the glass.', flag: 'key' }] }],
  tools: [{ id: 'tool-id', name: 'Identity Lookup', icon: 'identity', results: [{ query: 'Emeka', outcome: 'hit', rows: [{ label: 'Permit', value: 'Nursery' }] }] }],
  timeline: [{ time: '11:50', event: 'Goodnight in the study.', source: 'Emeka', conflict: true }],
  solutionSuspectId: 's3',
  keyEvidenceId: 'r2',
  explanation: 'Emeka poured the dosed glass.',
});

function start(startedAt: EpochMs = 1000 as EpochMs, roster: PlayerRef[] = players) {
  const input: InitInput<ReturnType<typeof investigationGame.configSchema.parse>, typeof content> = {
    config: investigationGame.configSchema.parse({ investigateSeconds: 300, revealSeconds: 12 }),
    content,
    players: roster,
    seed: 'seed',
    startedAt,
    random: () => 0.5,
  };
  return investigationGame.init(input);
}

const ctx = (actorId: string, now: EpochMs): ActionCtx => ({
  actor: { id: actorId, nickname: actorId },
  role: ActorRole.PLAYER,
  now,
  random: () => 0.5,
});
const tickCtx = (): TickCtx => ({}) as TickCtx;
const playerView = (state: Parameters<typeof investigationGame.view>[0], id: string) =>
  investigationGame.view(state, { kind: AudienceKind.PLAYER, playerId: id, spectator: false }, {} as never);

const accuse = (suspectId: string, evidenceId = '', confidence = 'solid') => ({ type: 'investigation.accuse' as const, suspectId, evidenceId, confidence: confidence as 'solid' });

describe('investigation: setup + secrecy', () => {
  it('starts in INVESTIGATE with the full case file but NO solution', () => {
    const { state } = start();
    expect(state.phase).toBe('investigate');
    const v = playerView(state, 'a');
    expect(v.title).toBe('The Last Pour');
    expect(Array.isArray(v.reports)).toBe(true);
    expect(Array.isArray(v.tools)).toBe(true);
    expect(v.solutionSuspectId).toBeUndefined();
    expect(v.keyEvidenceId).toBeUndefined();
    expect(v.explanation).toBeUndefined();
  });
});

describe('investigation: accusation', () => {
  it('records an accusation and locks the player; ignores an unknown suspect', () => {
    const { state } = start();
    const after = investigationGame.onAction(state, accuse('s1', 'r2', 'hunch'), ctx('a', 1100 as EpochMs));
    expect(after.state.accusations).toHaveLength(1);
    const v = playerView(after.state, 'a');
    expect(v.locked).toBe(true);
    expect(v.yourAccusation).toBe('s1');
    expect(v.yourEvidence).toBe('r2');
    // Unknown suspect → no-op.
    const bad = investigationGame.onAction(after.state, accuse('nope'), ctx('a', 1200 as EpochMs));
    expect(bad.state.accusations).toHaveLength(1);
  });

  it('lets a player revise their accusation (latest wins)', () => {
    const { state } = start();
    const s1 = investigationGame.onAction(state, accuse('s1'), ctx('a', 1100 as EpochMs)).state;
    const s2 = investigationGame.onAction(s1, accuse('s3'), ctx('a', 1200 as EpochMs)).state;
    expect(s2.accusations).toHaveLength(1);
    expect(s2.accusations[0]?.suspectId).toBe('s3');
  });
});

describe('investigation: early advance', () => {
  it('jumps to REVEAL once every player has locked in', () => {
    const { state } = start();
    const s1 = investigationGame.onAction(state, accuse('s3'), ctx('a', 1100 as EpochMs)).state;
    expect(s1.phase).toBe('investigate'); // only 1 of 2
    const step = investigationGame.onAction(s1, accuse('s1'), ctx('b', 1200 as EpochMs));
    expect(step.state.phase).toBe('reveal'); // both in → early reveal
  });

  it('solo (roster 1) reveals on the first accusation', () => {
    const { state } = start(1000 as EpochMs, [{ id: 'a', nickname: 'Ada' }]);
    const step = investigationGame.onAction(state, accuse('s3'), ctx('a', 1100 as EpochMs));
    expect(step.state.phase).toBe('reveal');
  });
});

describe('investigation: reasoned scoring', () => {
  function revealWith(accusations: { id: string; suspectId: string; evidenceId?: string; confidence?: string; at: number }[]) {
    let state = start().state;
    for (const a of accusations) {
      state = investigationGame.onAction(state, accuse(a.suspectId, a.evidenceId ?? '', a.confidence ?? 'solid'), ctx(a.id, a.at as EpochMs)).state;
    }
    // Force reveal if not already (e.g. partial roster) by ticking the investigate window.
    if (state.phase === 'investigate') state = investigationGame.onTick(state, 999999 as EpochMs, tickCtx()).state;
    return state;
  }

  it('wrong suspect scores 0', () => {
    const state = revealWith([{ id: 'a', suspectId: 's1', at: 1100 }]);
    expect(investigationGame.view(state, { kind: AudienceKind.PLAYER, playerId: 'a', spectator: false }, {} as never).yourScore).toBe(0);
  });

  it('right suspect + key evidence + confidence scores base+bonus, fastest highest', () => {
    // a: right, fastest, key evidence, certain. b: right, slower, no evidence, solid.
    const state = revealWith([
      { id: 'a', suspectId: 's3', evidenceId: 'r2', confidence: 'certain', at: 1100 },
      { id: 'b', suspectId: 's3', evidenceId: '', confidence: 'solid', at: 1200 },
    ]);
    const sa = investigationGame.view(state, { kind: AudienceKind.PLAYER, playerId: 'a', spectator: false }, {} as never).yourScore as number;
    const sb = investigationGame.view(state, { kind: AudienceKind.PLAYER, playerId: 'b', spectator: false }, {} as never).yourScore as number;
    // a: 800 * 1.15 + 200 = 1120 ; b: 700 * 1 = 700.
    expect(sa).toBe(1120);
    expect(sb).toBe(700);
    expect(sa).toBeGreaterThan(sb);
  });
});

describe('investigation: reveal projects the answer', () => {
  it('reveal carries solution, key evidence, explanation, and a board', () => {
    let state = start(1000 as EpochMs, [{ id: 'a', nickname: 'Ada' }]).state;
    state = investigationGame.onAction(state, accuse('s3', 'r2', 'solid'), ctx('a', 1100 as EpochMs)).state;
    expect(state.phase).toBe('reveal');
    const v = playerView(state, 'a');
    expect(v.solutionSuspectId).toBe('s3');
    expect(v.keyEvidenceId).toBe('r2');
    expect(v.explanation).toBe('Emeka poured the dosed glass.');
    expect(Array.isArray(v.board)).toBe(true);
  });

  it('the final board includes EVERY player — solvers AND wrong/non-accusers (score 0)', () => {
    // a accuses correctly, b accuses wrong, c never accuses. All three must appear on the board.
    const roster = [
      { id: 'a', nickname: 'Ada' },
      { id: 'b', nickname: 'Ben' },
      { id: 'c', nickname: 'Cee' },
    ];
    let state = start(1000 as EpochMs, roster).state;
    state = investigationGame.onAction(state, accuse('s3', 'r2', 'certain'), ctx('a', 1100 as EpochMs)).state;
    state = investigationGame.onAction(state, accuse('s1', '', 'solid'), ctx('b', 1200 as EpochMs)).state;
    // c never accuses; the window closes.
    state = investigationGame.onTick(state, 999999 as EpochMs, tickCtx()).state;
    const board = playerView(state, 'a').board as { playerId: string; points: number }[];
    const ids = board.map((r) => r.playerId).sort();
    expect(ids).toEqual(['a', 'b', 'c']); // all three present
    expect(board.find((r) => r.playerId === 'b')?.points).toBe(0); // wrong = 0, still listed
    expect(board.find((r) => r.playerId === 'c')?.points).toBe(0); // no accusation = 0, still listed
    expect((board.find((r) => r.playerId === 'a')?.points ?? 0) > 0).toBe(true);
  });
});
