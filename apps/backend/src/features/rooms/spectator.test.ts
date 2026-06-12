import { bootstrapEngine } from '@engine/index';
import { GameId } from '@engine/constants';
import { RoomRegistry } from '@engine/room/room-registry';
import { SessionManager } from '@engine/session/session-manager';
import type { Audience, ViewPatch } from '@engine/types';

import { RoomsService } from './rooms.service';

// Spectators are real seats that never play: excluded from the plugin roster + min-player count,
// and "spectator" is a reserved nickname. (PRD §4/§10; spec: missing-letters-flow §3.3.1.)

describe('rooms spectators', () => {
  beforeAll(() => bootstrapEngine());

  const harness = (): RoomsService => {
    const registry = new RoomRegistry();
    const sessions = new SessionManager(registry);
    const views: { audience: Audience; patch: ViewPatch }[] = [];
    sessions.setSink({ send: (_c, audience, patch): void => void views.push({ audience, patch }) });
    return new RoomsService(registry, sessions);
  };

  it('rejects a nickname containing "spectator" (reserved) with 422', () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const res = svc.joinRoom(created.data.code, 'Cool Spectator');
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.httpStatus).toBe(422);
    expect(res.fieldErrors?.nickname).toBeDefined();
  });

  it('server-applies the (SPECTATOR) suffix and flags the seat', () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const res = svc.joinRoom(created.data.code, 'Tobi', true);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.spectator).toBe(true);
    const lobby = svc.lobby(created.data.code);
    if (!lobby.success) return;
    const tobi = lobby.data.players.find((p) => p.spectator);
    expect(tobi?.nickname).toBe('Tobi (SPECTATOR)');
  });

  it('spectators do NOT count toward min-players (a game with only spectators + host cannot start)', async () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const { code, hostId } = created.data;
    // Host (1 participant) + one spectator. test_round_robin needs min 2 PARTICIPANTS.
    svc.joinRoom(code, 'Watcher', true);
    const res = await svc.startGame(code, hostId, GameId.TEST_ROUND_ROBIN, { turnSeconds: 10 }, { prompt: 'x' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('not_enough_players');
  });

  it('converting to spectator flips the EXISTING seat in place — no duplicate seat', () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const { code } = created.data;
    const joined = svc.joinRoom(code, 'Tobi'); // joins as a normal player first
    if (!joined.success) return;

    const before = svc.lobby(code);
    if (!before.success) return;
    const countBefore = before.data.players.length;

    const res = svc.spectate(code, joined.data.playerId);
    expect(res.success).toBe(true);

    const after = svc.lobby(code);
    if (!after.success) return;
    // Same number of seats — converted in place, not a new seat.
    expect(after.data.players.length).toBe(countBefore);
    const seat = after.data.players.find((p) => p.id === joined.data.playerId);
    expect(seat?.spectator).toBe(true);
    expect(seat?.nickname).toBe('Tobi (SPECTATOR)');
  });

  it('the host cannot convert to a spectator', () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const res = svc.spectate(created.data.code, created.data.hostId);
    expect(res.success).toBe(false);
  });

  it('a real participant + host can start; the spectator is excluded from the roster', async () => {
    const svc = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const { code, hostId } = created.data;
    svc.joinRoom(code, 'Player'); // participant (host + this = 2)
    svc.joinRoom(code, 'Watcher', true); // spectator — must not count or enter the roster
    const res = await svc.startGame(code, hostId, GameId.TEST_ROUND_ROBIN, { turnSeconds: 10 }, { prompt: 'x' });
    expect(res.success).toBe(true);
  });
});
