import { bootstrapEngine } from '@engine/index';
import { GameId } from '@engine/constants';
import { RoomRegistry } from '@engine/room/room-registry';
import { RoomPhase } from '@engine/room/room.types';
import { SessionManager } from '@engine/session/session-manager';

import { RoomsService } from './rooms.service';

// end-game + lobby.activeGame: a running game can be discovered (lobby) and ended (back to lobby),
// so the host never dead-ends on game_already_running.

describe('rooms end-game + lobby.activeGame', () => {
  beforeAll(() => bootstrapEngine());

  const harness = (): { svc: RoomsService; sessions: SessionManager; registry: RoomRegistry } => {
    const registry = new RoomRegistry();
    const sessions = new SessionManager(registry);
    sessions.setSink({ send: (): void => undefined });
    return { svc: new RoomsService(registry, sessions), sessions, registry };
  };

  async function startedRoom(): Promise<{ svc: RoomsService; sessions: SessionManager; code: string; hostId: string; gameId: string }> {
    const { svc, sessions } = harness();
    const created = svc.createRoom('Host');
    if (!created.success) throw new Error('create failed');
    const { code, hostId } = created.data;
    svc.joinRoom(code, 'Tobi');
    const started = await svc.startGame(code, hostId, GameId.TEST_ROUND_ROBIN, { turnSeconds: 10 }, { prompt: 'x' });
    if (!started.success) throw new Error('start failed');
    return { svc, sessions, code, hostId, gameId: started.data.gameId };
  }

  it('lobby exposes the running game in activeGame', async () => {
    const { svc, code, gameId } = await startedRoom();
    const lobby = svc.lobby(code);
    expect(lobby.success).toBe(true);
    if (!lobby.success) return;
    expect(lobby.data.phase).toBe(RoomPhase.IN_GAME);
    expect(lobby.data.activeGame).not.toBeNull();
    expect(lobby.data.activeGame?.gameId).toBe(gameId);
    expect(lobby.data.activeGame?.instanceId).toMatch(/^gi_/);
  });

  it('a lobby with no game has activeGame: null', () => {
    const { svc } = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const lobby = svc.lobby(created.data.code);
    if (!lobby.success) return;
    expect(lobby.data.activeGame).toBeNull();
  });

  it('host ends the running game and the room returns to the lobby', async () => {
    const { svc, sessions, code, hostId } = await startedRoom();
    const ended = await svc.endGame(code, hostId);
    expect(ended.success).toBe(true);
    if (!ended.success) return;
    expect(ended.data.phase).toBe(RoomPhase.LOBBY);
    expect(sessions.has(code)).toBe(false); // session disposed
    const lobby = svc.lobby(code);
    if (!lobby.success) return;
    expect(lobby.data.activeGame).toBeNull();
  });

  it('rejects end-game from a non-host with not_host', async () => {
    const { svc, code } = await startedRoom();
    const res = await svc.endGame(code, 'pl_not_the_host');
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('not_host');
  });

  it('end-game is idempotent — ending with no running game just confirms lobby', async () => {
    const { svc } = harness();
    const created = svc.createRoom('Host');
    if (!created.success) return;
    const { code, hostId } = created.data;
    const res = await svc.endGame(code, hostId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.phase).toBe(RoomPhase.LOBBY);
  });

  it('404s end-game on an unknown room', async () => {
    const { svc } = harness();
    const res = await svc.endGame('ZZZZZZ', 'pl_x');
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('room_not_found');
  });

  // Regression: a room wedged in `suspended` with no active game (host returned to the lobby,
  // which holds no socket to trigger gateway resume) must self-heal — otherwise start 409s forever
  // with the misleading game_already_running. See the logged repro (phase: 'suspended', activeGame: null).
  describe('suspended-room self-heal', () => {
    it('lobby() heals a suspended/no-game room back to lobby', () => {
      const { svc, registry } = harness();
      const created = svc.createRoom('Host');
      if (!created.success) return;
      const room = registry.get(created.data.code);
      if (!room) throw new Error('room missing');
      room.phase = RoomPhase.SUSPENDED; // simulate the wedge (host-left grace that never resumed)

      const lobby = svc.lobby(created.data.code);
      if (!lobby.success) return;
      expect(lobby.data.phase).toBe(RoomPhase.LOBBY); // healed
    });

    it('startGame succeeds on a suspended/no-game room instead of 409', async () => {
      const { svc, registry } = harness();
      const created = svc.createRoom('Host');
      if (!created.success) return;
      const { code, hostId } = created.data;
      svc.joinRoom(code, 'Tobi');
      const room = registry.get(code);
      if (!room) throw new Error('room missing');
      room.phase = RoomPhase.SUSPENDED;

      const started = await svc.startGame(code, hostId, GameId.TEST_ROUND_ROBIN, { turnSeconds: 10 }, { prompt: 'x' });
      expect(started.success).toBe(true); // not a 409 game_already_running
    });

    it('does NOT heal a suspended room that has an active game (real in-flight grace)', () => {
      const { svc, registry } = harness();
      const created = svc.createRoom('Host');
      if (!created.success) return;
      const room = registry.get(created.data.code);
      if (!room) throw new Error('room missing');
      room.phase = RoomPhase.SUSPENDED;
      room.activeGame = { instanceId: 'gi_test', gameId: GameId.TEST_ROUND_ROBIN };

      const lobby = svc.lobby(created.data.code);
      if (!lobby.success) return;
      expect(lobby.data.phase).toBe(RoomPhase.SUSPENDED); // left untouched — a game is mid-grace
    });
  });
});
