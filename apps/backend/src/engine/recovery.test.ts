import { GameId } from './constants';
import type { OutputSink } from './output-sink';
import { SingleSession } from './session/single-session';
import type { GameSnapshot } from './snapshot';
import { simultaneousTestGame } from './test-games/simultaneous.plugin';
import type { Audience, ViewPatch } from './types';

// Minimal smoke test — proves the recovery path closes the restart gap: a self-sufficient snapshot
// (carrying seed + players + state) rebuilds a session whose runtime keeps the snapshot's identity
// and re-broadcasts. Redis-free (we hand-build the snapshot), so it stays deterministic.

const recordingSink = (): { sink: OutputSink; views: { audience: Audience; patch: ViewPatch }[] } => {
  const views: { audience: Audience; patch: ViewPatch }[] = [];
  return { sink: { send: (_c, audience, patch): void => void views.push({ audience, patch }) }, views };
};

describe('recovery — SingleSession.recover', () => {
  it('rebuilds a session from a snapshot, keeps instanceId, and re-broadcasts', async () => {
    const { sink, views } = recordingSink();

    const snapshot: GameSnapshot = {
      roomCode: 'RECOV1',
      instanceId: 'gi_fixed_for_test',
      gameId: GameId.TEST_SIMULTANEOUS,
      seed: 'seed-123',
      players: [
        { id: 'pl_a', nickname: 'A' },
        { id: 'pl_b', nickname: 'B' },
      ],
      // a mid-game state the plugin would have produced
      state: {
        phase: 'question',
        qIndex: 0,
        rounds: 1,
        secondsPerQuestion: 30,
        questions: [{ id: 'q1', prompt: 'pick', target: 50 }],
        deadline: Date.now() + 30_000,
        answers: [],
      },
      timers: [{ key: 'question', fireAt: Date.now() + 30_000 }],
      pendingRefs: [],
      snapshotAt: Date.now(),
    };

    const session = SingleSession.recover({ plugin: simultaneousTestGame, snapshot, sink });

    // identity preserved (no new gi_ minted)
    expect(session.runtime.instanceId).toBe('gi_fixed_for_test');
    // rehydrate re-broadcasts to host + display + both players
    expect(views.length).toBeGreaterThan(0);
    // state restored
    const state = session.runtime.snapshotState() as { qIndex: number };
    expect(state.qIndex).toBe(0);

    await session.dispose();
  });

  // BUG-02 regression: a deadline that elapsed while the server was down must FIRE on recovery,
  // not be silently dropped. The snapshot is in `question` with a past deadline → after recover,
  // the missed onTick must have advanced the phase to `reveal`.
  it('fires a missed deadline on recovery (does not drop it)', async () => {
    const { sink } = recordingSink();
    const past = Date.now() - 5_000;

    const snapshot: GameSnapshot = {
      roomCode: 'RECOV2',
      instanceId: 'gi_recov2',
      gameId: GameId.TEST_SIMULTANEOUS,
      seed: 'seed-x',
      players: [{ id: 'pl_a', nickname: 'A' }],
      state: {
        phase: 'question',
        qIndex: 0,
        rounds: 1,
        secondsPerQuestion: 30,
        revealSeconds: 3,
        questions: [{ id: 'q1', prompt: 'pick', target: 50 }],
        deadline: past,
        answers: [],
      },
      timers: [{ key: 'question', fireAt: past }], // elapsed while down
      pendingRefs: [],
      snapshotAt: past,
    };

    const session = SingleSession.recover({ plugin: simultaneousTestGame, snapshot, sink });
    const state = session.runtime.snapshotState() as { phase: string };
    expect(state.phase).toBe('reveal'); // missed deadline fired → advanced, not stuck on 'question'

    await session.dispose();
  });
});
