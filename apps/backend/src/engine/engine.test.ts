import { ActorRole } from './constants';
import { GameRuntime } from './game-runtime';
import type { OutputSink } from './output-sink';
import { simultaneousTestGame } from './test-games/simultaneous.plugin';
import type { Audience, PlayerRef, ViewPatch } from './types';

// Minimal smoke test — proves the plugin/runtime contract closes: a simultaneous game inits,
// accepts an action, and scores. Not full coverage (real suites come later).

const recordingSink = (): { sink: OutputSink; views: { audience: Audience; patch: ViewPatch }[] } => {
  const views: { audience: Audience; patch: ViewPatch }[] = [];
  return { sink: { send: (_room, audience, patch): void => void views.push({ audience, patch }) }, views };
};

describe('GameRuntime + simultaneous test game', () => {
  const players: PlayerRef[] = [
    { id: 'pl_a', nickname: 'A' },
    { id: 'pl_b', nickname: 'B' },
  ];

  it('starts, fans out an initial view, and accepts an answer', async () => {
    const { sink, views } = recordingSink();
    const runtime = new GameRuntime({ roomCode: 'ABC123', plugin: simultaneousTestGame, players, sink });

    runtime.start(
      { rounds: 1, secondsPerQuestion: 30 },
      { questions: [{ id: 'q1', prompt: 'pick a number', target: 50 }] },
    );

    // init broadcast reached host + display + both players
    expect(views.length).toBeGreaterThan(0);

    runtime.dispatchAction(players[0]!, ActorRole.PLAYER, { type: 'test_sim.answer', questionId: 'q1', value: 48 });

    const state = runtime.snapshotState() as { answers: { playerId: string }[] };
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]!.playerId).toBe('pl_a');

    // dispose clears the runtime's timers (otherwise the debounced snapshot keeps the loop alive).
    await runtime.dispose();
  });
});
