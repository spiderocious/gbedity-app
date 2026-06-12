import { ActorRole, HostActionType } from './constants';
import { GameRuntime } from './game-runtime';
import type { OutputSink } from './output-sink';
import { simultaneousTestGame } from './test-games/simultaneous.plugin';
import type { PlayerRef } from './types';

// Engine-level host controls (host.end_game / host.skip) are handled by the runtime BEFORE the
// plugin's actionSchema, and ONLY for the token-verified host role. This is the fix for "End game
// does nothing / action dispatch rejected" (the action isn't a game action, so it must not go
// through per-game validation).

const players: PlayerRef[] = [
  { id: 'pl_host', nickname: 'Host' },
  { id: 'pl_two', nickname: 'Two' },
];
const host = players[0]!;
const player = players[1]!;

const config = { rounds: 2, secondsPerQuestion: 30, revealSeconds: 3 };
const content = { questions: [{ id: 'q1', prompt: 'pick', target: 50 }, { id: 'q2', prompt: 'pick', target: 10 }] };

function makeRuntime(onGameEnded: () => void): GameRuntime {
  const runtime = new GameRuntime({ roomCode: 'HA1', plugin: simultaneousTestGame, players, onGameEnded });
  runtime.start(config, content);
  return runtime;
}

describe('engine host controls', () => {
  it('host.end_game from the HOST role ends the game (onGameEnded fires)', () => {
    const ended = jest.fn();
    const runtime = makeRuntime(ended);
    runtime.dispatchAction(host, ActorRole.HOST, { type: HostActionType.END_GAME });
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('host.end_game from a PLAYER role is ignored (no end, no throw)', () => {
    const ended = jest.fn();
    const runtime = makeRuntime(ended);
    // A non-host emitting a host action must be a silent no-op — NOT a thrown ZodError.
    expect(() => runtime.dispatchAction(player, ActorRole.PLAYER, { type: HostActionType.END_GAME })).not.toThrow();
    expect(ended).not.toHaveBeenCalled();
  });

  it('host.end_game signals gameOver through the sink (clients leave the in-game screen)', () => {
    const gameOver = jest.fn();
    const recording: OutputSink = { send: (): void => undefined, gameOver };
    const runtime = new GameRuntime({ roomCode: 'HA2', plugin: simultaneousTestGame, players, sink: recording, onGameEnded: jest.fn() });
    runtime.start(config, content);
    runtime.dispatchAction(host, ActorRole.HOST, { type: HostActionType.END_GAME });
    expect(gameOver).toHaveBeenCalledWith('HA2');
  });

  it('host control actions never reach the plugin actionSchema (no "invalid_action" throw)', () => {
    const runtime = makeRuntime(jest.fn());
    // host.skip is not a valid missing-letters/test-sim game action; before this fix it threw a
    // ZodError. Now the runtime intercepts it pre-validation.
    expect(() => runtime.dispatchAction(host, ActorRole.HOST, { type: HostActionType.SKIP })).not.toThrow();
  });
});
