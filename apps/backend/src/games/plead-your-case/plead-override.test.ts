import { ActorRole } from '@engine/constants';
import type { ActionCtx } from '@engine/types';

import { pleadYourCaseGame } from './plead-your-case.plugin';

// BUG-A regression: plead.override is HOST-ONLY. A player must not be able to set the winner.

const REVEAL_STATE = {
  phase: 'reveal',
  roundIndex: 0,
  rounds: 1,
  argumentSeconds: 300,
  revealSeconds: 8,
  scenarios: [{ charge: 'c', defendant: 'd', facts: 'f', laws: 'l', precedents: 'p' }],
  rubric: [{ key: 'k', label: 'l', weight: 1 }],
  deadline: 0,
  submissions: [{ playerId: 'pl_a', argument: 'x' }],
  pending: [],
  results: [{ playerId: 'pl_a', ok: true, total: 50, perCriterion: [] }],
  hostOverrideWinner: null,
  scores: {},
};

const ctx = (role: ActorRole): ActionCtx => ({
  actor: { id: 'pl_attacker', nickname: 'A' },
  role,
  now: 1000,
  random: () => 0.5,
});

describe('plead.override is host-only (BUG-A)', () => {
  it('rejects an override from a player', () => {
    const step = pleadYourCaseGame.onAction(
      REVEAL_STATE as never,
      { type: 'plead.override', winnerId: 'pl_attacker' } as never,
      ctx(ActorRole.PLAYER),
    );
    expect((step.state as { hostOverrideWinner: string | null }).hostOverrideWinner).toBeNull();
    expect(step.effects).toHaveLength(0);
  });

  it('honors an override from the host', () => {
    const step = pleadYourCaseGame.onAction(
      REVEAL_STATE as never,
      { type: 'plead.override', winnerId: 'pl_a' } as never,
      ctx(ActorRole.HOST),
    );
    expect((step.state as { hostOverrideWinner: string | null }).hostOverrideWinner).toBe('pl_a');
  });
});
