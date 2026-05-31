import { bootstrapEngine } from '@engine/index';
import { GameId } from '@engine/constants';
import { RoomRegistry } from '@engine/room/room-registry';
import { SessionManager } from '@engine/session/session-manager';
import type { Audience, ViewPatch } from '@engine/types';

import { RoomsService } from './rooms.service';

// Minimal smoke test — proves the full loop is reachable WITHOUT a live socket: create room → join
// → start game (via an injected SessionManager with a fake sink) → the engine fans out views.

describe('rooms start-game wiring', () => {
  beforeAll(() => bootstrapEngine()); // registers the test-game plugins

  // Fresh registry + session manager per test, with a recording sink — full isolation.
  const harness = (): { svc: RoomsService; sessions: SessionManager; views: { audience: Audience; patch: ViewPatch }[] } => {
    const views: { audience: Audience; patch: ViewPatch }[] = [];
    const registry = new RoomRegistry();
    const sessions = new SessionManager(registry);
    sessions.setSink({ send: (_c, audience, patch): void => void views.push({ audience, patch }) });
    return { svc: new RoomsService(registry, sessions), sessions, views };
  };

  it('host starts a game and the engine broadcasts an initial view', async () => {
    const { svc, sessions, views } = harness();
    const created = svc.createRoom('Host');
    expect(created.success).toBe(true);
    if (!created.success) return;
    const { code, hostId } = created.data;

    svc.joinRoom(code, 'Tobi'); // round-robin test game needs ≥2 players

    const started = await svc.startGame(code, hostId, GameId.TEST_ROUND_ROBIN, { turnSeconds: 10 }, { prompt: 'say something' });
    expect(started.success).toBe(true);
    if (!started.success) return;
    expect(started.data.instanceId).toMatch(/^gi_/);
    expect(views.length).toBeGreaterThan(0); // init broadcast fanned out
    expect(sessions.has(code)).toBe(true);

    await sessions.end(code);
  });

  it('rejects start from a non-host', async () => {
    const { svc } = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    svc.joinRoom(created.data.code, 'Tobi');

    const res = await svc.startGame(created.data.code, 'pl_not_the_host', GameId.TEST_ROUND_ROBIN, {}, {});
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('not_host');
  });
});
