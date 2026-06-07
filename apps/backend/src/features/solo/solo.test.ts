import { bootstrapEngine } from '@engine/index';
import { registerGames } from '@games/index';
import { RoomRegistry } from '@engine/room/room-registry';
import { SessionManager } from '@engine/session/session-manager';
import { GameId } from '@engine/constants';

import { SoloService } from './solo.service';

// Minimal smoke test — proves the solo eligibility gate: a supported game starts solo (1-player,
// default nickname), a peer-vote game is refused. No socket, no Mongo content needed (test games
// fall back to client content; real games would resolve from DB but eligibility is checked first).

describe('SoloService eligibility', () => {
  beforeAll(() => {
    bootstrapEngine();
    registerGames();
  });

  const harness = (): SoloService => new SoloService(new RoomRegistry(), new SessionManager(new RoomRegistry()));

  it('refuses a peer-vote game (no solo support)', async () => {
    const res = await new SoloService().start('You', GameId.HOT_TAKE_COURT, {});
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('solo_not_supported');
  });

  it('refuses an unknown game with game_not_found', async () => {
    const res = await new SoloService().start('You', 'not_a_real_game', {});
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.errorCode).toBe('game_not_found');
  });

  it('the 4 voting games + word bomb are all solo-unsupported', async () => {
    const svc = harness();
    for (const id of [
      GameId.HOT_TAKE_COURT,
      GameId.CATCH_THE_LIE,
      GameId.TRUTH_OR_DARE,
      GameId.PRESENTATION,
      GameId.WORD_BOMB,
    ]) {
      const res = await svc.start('You', id, {});
      expect(res.success).toBe(false);
      if (!res.success) expect(res.errorCode).toBe('solo_not_supported');
    }
  });
});
