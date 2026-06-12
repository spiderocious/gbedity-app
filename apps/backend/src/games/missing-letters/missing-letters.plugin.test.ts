import { ActorRole, AudienceKind } from '@engine/constants';
import type { ActionCtx, InitInput, PlayerRef, TickCtx } from '@engine/types';
import type { EpochMs } from '@shared/time';

import { missingLettersGame } from './missing-letters.plugin';

// Missing Letters plugin behaviour: the COUNTDOWN start beat (server-timed 3·2·1·GO) and the
// one-submission-per-round lock (right OR wrong → locked, no retries). Driven through the pure
// step functions (init/onAction/onTick/view) — no runtime/timers needed.

const players: PlayerRef[] = [
  { id: 'a', nickname: 'Ada' },
  { id: 'b', nickname: 'Ben' },
];

const content = {
  words: [
    { answer: 'music', revealed: [0, 1, 2] }, // m u s _ _
    { answer: 'house', revealed: [0, 1] }, //    h o _ _ _
  ],
};

function parseConfig(over: Record<string, unknown> = {}): ReturnType<typeof missingLettersGame.configSchema.parse> {
  return missingLettersGame.configSchema.parse({ rounds: 2, secondsPerRound: 20, revealSeconds: 3, countdownSeconds: 4, ...over });
}

function start(startedAt: EpochMs = 1000 as EpochMs) {
  const input: InitInput<ReturnType<typeof parseConfig>, typeof content> = {
    config: parseConfig(),
    content,
    players,
    seed: 'seed',
    startedAt,
    random: () => 0.5,
  };
  return missingLettersGame.init(input);
}

const actionCtx = (actorId: string, now: EpochMs): ActionCtx => ({
  actor: players.find((p) => p.id === actorId)!,
  role: ActorRole.PLAYER,
  now,
  random: () => 0.5,
});
const tickCtx = (): TickCtx => ({}) as TickCtx;
const playerView = (state: Parameters<typeof missingLettersGame.view>[0], id: string) =>
  missingLettersGame.view(state, { kind: AudienceKind.PLAYER, playerId: id, spectator: false }, {} as never);

describe('missing-letters: countdown start beat', () => {
  it('starts in the COUNTDOWN phase with a deadline at startedAt + countdownSeconds', () => {
    const { state } = start(1000 as EpochMs);
    expect(state.phase).toBe('countdown');
    expect(state.deadline).toBe(1000 + 4 * 1000);
  });

  it('countdown tick advances to round 1 with a fresh round deadline', () => {
    const { state: countdown } = start(1000 as EpochMs);
    const { state: round } = missingLettersGame.onTick(countdown, 5000 as EpochMs, tickCtx());
    expect(round.phase).toBe('round');
    expect(round.idx).toBe(0);
    expect(round.deadline).toBe(5000 + 20 * 1000);
    expect(round.answered).toEqual([]);
  });

  it('does not accept guesses during countdown (only ROUND phase)', () => {
    const { state: countdown } = start();
    const { state } = missingLettersGame.onAction(countdown, { type: 'missing_letters.guess', text: 'music' }, actionCtx('a', 2000 as EpochMs));
    expect(state.answered).toEqual([]);
    expect(state.solved).toEqual([]);
  });
});

describe('missing-letters: one submission per round (lock)', () => {
  function inRound() {
    const { state: countdown } = start(1000 as EpochMs);
    return missingLettersGame.onTick(countdown, 5000 as EpochMs, tickCtx()).state; // → round 0
  }

  it('a CORRECT guess locks the player and scores them', () => {
    const round = inRound();
    const { state } = missingLettersGame.onAction(round, { type: 'missing_letters.guess', text: 'music' }, actionCtx('a', 6000 as EpochMs));
    expect(state.answered).toContain('a');
    expect(state.solved.map((s) => s.playerId)).toContain('a');
    expect(playerView(state, 'a').locked).toBe(true);
  });

  it('a WRONG guess STILL locks the player (no retry), but does not score', () => {
    const round = inRound();
    const { state } = missingLettersGame.onAction(round, { type: 'missing_letters.guess', text: 'wrong' }, actionCtx('a', 6000 as EpochMs));
    expect(state.answered).toContain('a');
    expect(state.solved.map((s) => s.playerId)).not.toContain('a');
    expect(playerView(state, 'a').locked).toBe(true);
  });

  it('a second guess after a wrong one is ignored (locked out — cannot fix it)', () => {
    const round = inRound();
    const afterWrong = missingLettersGame.onAction(round, { type: 'missing_letters.guess', text: 'wrong' }, actionCtx('a', 6000 as EpochMs)).state;
    const afterRetry = missingLettersGame.onAction(afterWrong, { type: 'missing_letters.guess', text: 'music' }, actionCtx('a', 6100 as EpochMs)).state;
    // Still not solved — the correct retry was rejected.
    expect(afterRetry.solved.map((s) => s.playerId)).not.toContain('a');
    expect(afterRetry.answered.filter((id) => id === 'a')).toHaveLength(1);
  });

  it('another player is unaffected by the first player locking', () => {
    const round = inRound();
    const afterA = missingLettersGame.onAction(round, { type: 'missing_letters.guess', text: 'wrong' }, actionCtx('a', 6000 as EpochMs)).state;
    const afterB = missingLettersGame.onAction(afterA, { type: 'missing_letters.guess', text: 'music' }, actionCtx('b', 6100 as EpochMs)).state;
    expect(afterB.solved.map((s) => s.playerId)).toContain('b');
    expect(playerView(afterB, 'b').locked).toBe(true);
    expect(playerView(afterB, 'a').locked).toBe(true);
  });

  it('answered + solved reset on the next round', () => {
    const round = inRound();
    const answered = missingLettersGame.onAction(round, { type: 'missing_letters.guess', text: 'music' }, actionCtx('a', 6000 as EpochMs)).state;
    const reveal = missingLettersGame.onTick(answered, 7000 as EpochMs, tickCtx()).state; // round → reveal
    const nextRound = missingLettersGame.onTick(reveal, 8000 as EpochMs, tickCtx()).state; // reveal → round 1
    expect(nextRound.phase).toBe('round');
    expect(nextRound.idx).toBe(1);
    expect(nextRound.answered).toEqual([]);
    expect(nextRound.solved).toEqual([]);
    expect(playerView(nextRound, 'a').locked).toBe(false);
  });
});
