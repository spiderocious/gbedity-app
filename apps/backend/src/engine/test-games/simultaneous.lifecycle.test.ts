import { EffectKind } from '../constants';
import { simultaneousTestGame } from './simultaneous.plugin';

// BUG-01 regression: the simultaneous game must actually END. Drives the pure onTick through
// question → reveal → done and asserts (a) reveal arms a timer so it can advance, and (b) the
// game emits GAME_ENDED rather than hanging in reveal. Pure-function test — no real timers.

// Reuse the plugin's own (module-private) State type via the init return — no re-typing, no `unknown`.
const start = simultaneousTestGame.init({
  config: { rounds: 1, secondsPerQuestion: 20, revealSeconds: 3 },
  content: { questions: [{ id: 'q1', prompt: 'pick', target: 50 }] },
  players: [{ id: 'pl_a', nickname: 'A' }],
  seed: 'seed',
  startedAt: 1_000,
  random: () => 0.5,
});

describe('simultaneous test game — lifecycle ends (BUG-01)', () => {
  it('question → reveal arms a reveal timer, then reveal → done emits GAME_ENDED', () => {
    const afterQuestion = simultaneousTestGame.onTick(start.state, 21_000, { random: () => 0.5 });
    const phase1 = (afterQuestion.state as { phase: string }).phase;
    expect(phase1).toBe('reveal');
    // reveal must arm a timer — without it the game hangs (the original bug)
    expect(afterQuestion.effects.some((e) => e.kind === EffectKind.START_TIMER)).toBe(true);

    const afterReveal = simultaneousTestGame.onTick(afterQuestion.state, 24_000, { random: () => 0.5 });
    expect((afterReveal.state as { phase: string }).phase).toBe('done');
    expect(afterReveal.effects.some((e) => e.kind === EffectKind.GAME_ENDED)).toBe(true);
    expect(simultaneousTestGame.isOver(afterReveal.state)).toBe(true);
  });
});
