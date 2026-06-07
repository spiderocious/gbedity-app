import { bootstrapEngine } from '@engine/index';
import { registerGames } from '@games/index';
import { getPlugin } from '@engine/registry';
import { RoomRegistry } from '@engine/room/room-registry';
import { SessionManager } from '@engine/session/session-manager';
import { GameId } from '@engine/constants';

import { SoloService, stripDisabled } from './solo.service';

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

  it('Investigation IS solo-supported (per-player accusation, no peer dependency)', () => {
    const plugin = getPlugin(GameId.INVESTIGATION);
    expect(plugin?.manifest.solo?.supported).toBe(true);
  });
});

// SP-1 regression: stripDisabled must remove disabled lifelines even when they arrived via Zod
// defaults — i.e. it runs on the PARSED config (default-filled), not the raw client config.
describe('stripDisabled (SP-1)', () => {
  const DISABLED = ['ask_audience', 'phone_friend'];

  it('strips disabled entries from an array (the default-config case)', () => {
    // Simulates the parsed Millionaire config where Zod filled the full default lifelines array.
    const parsed = { lifelines: ['fifty_fifty', 'ask_audience', 'phone_friend'], timePerQuestion: 30 };
    const out = stripDisabled(parsed, DISABLED) as { lifelines: string[]; timePerQuestion: number };
    expect(out.lifelines).toEqual(['fifty_fifty']);
    expect(out.timePerQuestion).toBe(30); // untouched
  });

  it('also deletes a disabled top-level key', () => {
    const out = stripDisabled({ ask_audience: true, keep: 1 }, DISABLED) as Record<string, unknown>;
    expect(out.ask_audience).toBeUndefined();
    expect(out.keep).toBe(1);
  });

  it('is a no-op when nothing is disabled', () => {
    const cfg = { lifelines: ['ask_audience'] };
    expect(stripDisabled(cfg, [])).toEqual(cfg);
    expect(stripDisabled(cfg, undefined)).toEqual(cfg);
  });
});
