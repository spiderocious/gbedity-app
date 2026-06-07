import { describe, expect, it } from 'vitest';

import { isValidRoomCode } from './index.ts';

describe('isValidRoomCode', () => {
  it('accepts 6 alphanumeric characters', () => {
    expect(isValidRoomCode('4DKBGH')).toBe(true);
    expect(isValidRoomCode('GBE4ZK')).toBe(true);
    expect(isValidRoomCode('abc123')).toBe(true); // case-insensitive
    expect(isValidRoomCode('000000')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidRoomCode('ABC12')).toBe(false); // 5
    expect(isValidRoomCode('ABC1234')).toBe(false); // 7
    expect(isValidRoomCode('')).toBe(false);
  });

  it('rejects non-alphanumeric characters', () => {
    expect(isValidRoomCode('GBE-4Z')).toBe(false); // dash (display form, not raw)
    expect(isValidRoomCode('ABC 12')).toBe(false); // space
    expect(isValidRoomCode('ABC!23')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidRoomCode(undefined)).toBe(false);
    expect(isValidRoomCode(null)).toBe(false);
    expect(isValidRoomCode(123456)).toBe(false);
  });
});
