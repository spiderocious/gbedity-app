import { describe, expect, it } from 'vitest';

import type { ViewPatch } from '../../../shared/types/view.ts';
import { LiveGameId, detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';

// The patch-shape detector is what makes "live by default" work — players land on the live
// screen with no ?live param, and the renderer is chosen from the patch alone. detectLiveGame now
// returns the backend gameId string (chrome is joined from the catalogue store at the call site).
describe('detectLiveGame', () => {
  const cases: Array<[string, ViewPatch, string]> = [
    ['quizzes', { phase: 'question', qIndex: 0, options: ['a', 'b'] }, LiveGameId.QUIZZES],
    ['wordshot', { phase: 'round', letter: 'a', ranked: [] }, LiveGameId.WORDSHOT],
    ['word_bomb', { phase: 'holding', holderId: 'pl_1', used: [] }, LiveGameId.WORD_BOMB],
    ['hot_take_court', { phase: 'submission', prompt: 'x', defences: [] }, LiveGameId.HOT_TAKE_COURT],
    ['plead_your_case', { phase: 'writing', scenario: { charge: 'x' } }, LiveGameId.PLEAD_YOUR_CASE],
  ];

  it.each(cases)('detects %s from its patch shape', (_name, patch, expected) => {
    expect(detectLiveGame(patch)).toBe(expected);
  });

  it('returns undefined for a null patch', () => {
    expect(detectLiveGame(null)).toBeUndefined();
  });
});

describe('resolveMockGame', () => {
  it('parses a numeric mock id', () => {
    expect(resolveMockGame('6')).toBe(6);
  });
  it('is undefined when absent or non-numeric', () => {
    expect(resolveMockGame(null)).toBeUndefined();
    expect(resolveMockGame('abc')).toBeUndefined();
  });
});

describe('resolveLiveHint', () => {
  it('passes through any non-empty backend id (the catalogue store decides reality, not this fn)', () => {
    expect(resolveLiveHint('wordshot')).toBe(LiveGameId.WORDSHOT);
    expect(resolveLiveHint('any_future_game')).toBe('any_future_game');
  });
  it('is undefined for absent/empty', () => {
    expect(resolveLiveHint(null)).toBeUndefined();
    expect(resolveLiveHint('')).toBeUndefined();
  });
});
