import { describe, expect, it } from 'vitest';

import { generateDicebearSvg } from '../helpers/generate-dicebear-svg.ts';

describe('generateDicebearSvg', () => {
  it('returns null for an empty or whitespace seed', () => {
    expect(generateDicebearSvg('')).toBeNull();
    expect(generateDicebearSvg('   ')).toBeNull();
  });

  it('returns an SVG data URI for a valid seed', () => {
    const result = generateDicebearSvg('temi');
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/svg\+xml;utf8,/);
    expect(decodeURIComponent(result ?? '')).toContain('<svg');
  });

  it('is deterministic — the same seed produces the same SVG', () => {
    expect(generateDicebearSvg('player-42')).toBe(generateDicebearSvg('player-42'));
  });

  it('produces different output for different seeds', () => {
    expect(generateDicebearSvg('ada')).not.toBe(generateDicebearSvg('temi'));
  });
});
