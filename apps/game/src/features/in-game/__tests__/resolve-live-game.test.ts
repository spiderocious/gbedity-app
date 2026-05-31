import { describe, expect, it } from 'vitest';

import { RealGameId } from '../../../shared/types/api.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';
import { detectLiveGame, resolveLiveHint, resolveMockGame } from '../resolve-live-game.ts';

// The patch-shape detector is what makes "live by default" work — players land on the live
// screen with no ?live param, and the renderer is chosen from the patch alone.
describe('detectLiveGame', () => {
  const cases: Array<[string, ViewPatch, string]> = [
    ['quizzes', { phase: 'question', qIndex: 0, options: ['a', 'b'] }, RealGameId.QUIZZES],
    ['wordshot', { phase: 'round', letter: 'a', ranked: [] }, RealGameId.WORDSHOT],
    ['word_bomb', { phase: 'holding', holderId: 'pl_1', used: [] }, RealGameId.WORD_BOMB],
    ['hot_take_court', { phase: 'submission', prompt: 'x', defences: [] }, RealGameId.HOT_TAKE_COURT],
    ['plead_your_case', { phase: 'writing', scenario: { charge: 'x' } }, RealGameId.PLEAD_YOUR_CASE],
  ];

  it.each(cases)('detects %s from its patch shape', (_name, patch, expected) => {
    expect(detectLiveGame(patch)?.backendId).toBe(expected);
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
  it('resolves a real backend id', () => {
    expect(resolveLiveHint('wordshot')?.backendId).toBe(RealGameId.WORDSHOT);
  });
  it('is undefined for unknown/absent', () => {
    expect(resolveLiveHint(null)).toBeUndefined();
    expect(resolveLiveHint('not_a_game')).toBeUndefined();
  });
});
