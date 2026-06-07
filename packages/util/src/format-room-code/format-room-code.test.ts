import { describe, expect, it } from 'vitest';

import { formatRoomCode, normalizeRoomCode } from './index.ts';

describe('normalizeRoomCode', () => {
  it('strips non-alphanumerics, uppercases, caps at 6', () => {
    expect(normalizeRoomCode('gbe-4zk')).toBe('GBE4ZK');
    expect(normalizeRoomCode('g b e 4 z k 9 9')).toBe('GBE4ZK');
    expect(normalizeRoomCode('ABC!@#123ZZ')).toBe('ABC123');
  });
});

describe('formatRoomCode', () => {
  it('inserts the hyphen after the 3rd char as you type', () => {
    expect(formatRoomCode('G')).toBe('G');
    expect(formatRoomCode('GBE')).toBe('GBE'); // no dash at exactly 3
    expect(formatRoomCode('GBE4')).toBe('GBE-4'); // dash appears on the 4th
    expect(formatRoomCode('GBE4Z')).toBe('GBE-4Z');
    expect(formatRoomCode('GBE4ZK')).toBe('GBE-4ZK');
  });

  it('formats a pasted 6-char code (no dash) correctly', () => {
    expect(formatRoomCode('GBE4ZK')).toBe('GBE-4ZK');
    expect(formatRoomCode('abc123')).toBe('ABC-123');
  });

  it('formats a pasted 7-char dashed code correctly', () => {
    expect(formatRoomCode('GBE-4ZK')).toBe('GBE-4ZK');
    expect(formatRoomCode('abc-123')).toBe('ABC-123');
  });

  it('caps overflow paste at 6 raw chars', () => {
    expect(formatRoomCode('GBE4ZK99')).toBe('GBE-4ZK');
    expect(formatRoomCode('GBE-4ZK-99')).toBe('GBE-4ZK');
  });

  it('handles empty input', () => {
    expect(formatRoomCode('')).toBe('');
  });

  describe('with trailingDash', () => {
    it('appends the dash at exactly 3 chars', () => {
      expect(formatRoomCode('GBE', { trailingDash: true })).toBe('GBE-');
      expect(formatRoomCode('abc', { trailingDash: true })).toBe('ABC-');
    });

    it('does not append below 3 chars', () => {
      expect(formatRoomCode('GB', { trailingDash: true })).toBe('GB');
      expect(formatRoomCode('', { trailingDash: true })).toBe('');
    });

    it('is irrelevant past 3 chars (real dash already present)', () => {
      expect(formatRoomCode('GBE4', { trailingDash: true })).toBe('GBE-4');
      expect(formatRoomCode('GBE4ZK', { trailingDash: true })).toBe('GBE-4ZK');
    });
  });
});
