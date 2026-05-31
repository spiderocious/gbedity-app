import { bootstrapEngine } from '@engine/index';
import { GameId } from '@engine/constants';
import type { GatewayHandle } from '@engine/gateway';
import type { SingleSession } from '@engine/session/single-session';
import type { Audience, ViewPatch } from '@engine/types';

import { RoomsService } from './rooms.service';

// Minimal smoke test — proves the full loop is now reachable WITHOUT a live socket: create room →
// join → start game (via an injected fake gateway handle) → the engine fans out views. This is the
// piece that removes the "engine not externally testable" gap from the QA handoff.

describe('rooms start-game wiring', () => {
  beforeAll(() => bootstrapEngine()); // registers the test-game plugins

  const fakeHandle = (): { handle: GatewayHandle; views: { audience: Audience; patch: ViewPatch }[] } => {
    const views: { audience: Audience; patch: ViewPatch }[] = [];
    const sessions = new Map<string, SingleSession>();
    return {
      handle: { sink: { send: (_c, audience, patch): void => void views.push({ audience, patch }) }, sessions },
      views,
    };
  };

  it('host starts a game and the engine broadcasts an initial view', async () => {
    const svc = new RoomsService();
    const created = svc.createRoom('Host');
    expect(created.success).toBe(true);
    if (!created.success) return;
    const { code, hostId } = created.data;

    svc.joinRoom(code, 'Tobi'); // round-robin test game needs ≥2 players

    const { handle, views } = fakeHandle();
    const started = svc.startGame(
      code,
      hostId,
      GameId.TEST_ROUND_ROBIN,
      { turnSeconds: 10 },
      { prompt: 'say something' },
      handle,
    );

    expect(started.success).toBe(true);
    if (!started.success) return;
    expect(started.data.instanceId).toMatch(/^gi_/);
    expect(views.length).toBeGreaterThan(0); // init broadcast fanned out
    expect(handle.sessions.has(code)).toBe(true);

    await handle.sessions.get(code)?.dispose();
  });

  it('rejects start from a non-host', () => {
    const svc = new RoomsService();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    svc.joinRoom(created.data.code, 'Tobi');

    const { handle } = fakeHandle();
    const res = svc.startGame(created.data.code, 'pl_not_the_host', GameId.TEST_ROUND_ROBIN, {}, {}, handle);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('not_host');
  });
});
