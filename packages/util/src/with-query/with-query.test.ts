import { describe, expect, it } from 'vitest';

import { withQuery } from './index.ts';

describe('withQuery', () => {
  it('returns the path unchanged when no params are given', () => {
    expect(withQuery('/join')).toBe('/join');
  });

  it('appends a single param', () => {
    expect(withQuery('/join', { code: 'GBE4ZK' })).toBe('/join?code=GBE4ZK');
  });

  it('appends multiple params', () => {
    expect(withQuery('/host/catalogue', { code: 'ABC123', mode: 'quick' })).toBe(
      '/host/catalogue?code=ABC123&mode=quick',
    );
  });

  it('merges with params already on the path', () => {
    expect(withQuery('/join?ref=qr', { code: 'ABC123' })).toBe('/join?ref=qr&code=ABC123');
  });

  it('skips null and undefined values', () => {
    expect(withQuery('/join', { code: 'ABC123', missing: undefined, none: null })).toBe(
      '/join?code=ABC123',
    );
  });

  it('stringifies numbers and booleans', () => {
    expect(withQuery('/g', { game: 6, live: true })).toBe('/g?game=6&live=true');
  });

  it('url-encodes values', () => {
    expect(withQuery('/x', { q: 'a b&c' })).toBe('/x?q=a+b%26c');
  });

  it('drops a trailing ? with no resulting params', () => {
    expect(withQuery('/join', {})).toBe('/join');
  });
});
