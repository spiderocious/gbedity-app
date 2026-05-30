import { describe, expect, it } from 'vitest';

import { seatFromId } from '../helpers/seat-from-id.ts';

describe('seatFromId', () => {
  it('returns a neutral identity for an empty id', () => {
    expect(seatFromId('')).toEqual({ seat: 1, initial: '?' });
    expect(seatFromId('   ')).toEqual({ seat: 1, initial: '?' });
  });

  it('derives the initial from the first character, uppercased', () => {
    expect(seatFromId('temi').initial).toBe('T');
    expect(seatFromId('  ada  ').initial).toBe('A');
    expect(seatFromId('9zebra').initial).toBe('9');
  });

  it('always picks a seat in the 1–8 range', () => {
    for (const id of ['a', 'player-42', 'room-XYZ', 'k', 'longer-nickname-here']) {
      const { seat } = seatFromId(id);
      expect(seat).toBeGreaterThanOrEqual(1);
      expect(seat).toBeLessThanOrEqual(8);
    }
  });

  it('is deterministic — the same id always yields the same result', () => {
    expect(seatFromId('player-42')).toEqual(seatFromId('player-42'));
  });
});
