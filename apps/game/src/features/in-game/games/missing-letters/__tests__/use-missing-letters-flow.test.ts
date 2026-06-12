import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ViewPatch } from '../../../../../shared/types/view.ts';
import { FlowStage, useMissingLettersFlow } from '../use-missing-letters-flow.ts';

// Backend-authoritative: the intro is cosmetic and ends the moment a real patch arrives; every
// backend phase maps straight to a stage (the fix for "host stuck with no word"). round-start is a
// brief flash that the hook itself times out into playing.

const patch = (over: Partial<ViewPatch>): ViewPatch => ({ phase: 'round', idx: 0, ...over }) as ViewPatch;

describe('useMissingLettersFlow (backend-authoritative)', () => {
  it('starts at intro before any patch', () => {
    const { result } = renderHook(() => useMissingLettersFlow(null));
    expect(result.current.stage).toBe(FlowStage.INTRO);
  });

  it('the FIRST round patch goes straight to playing (no round-start flash → no host/player desync)', () => {
    const { result } = renderHook(() => useMissingLettersFlow(patch({ phase: 'round', idx: 0 })));
    // First round: straight to the live word, synced to the backend deadline (the #1 fix).
    expect(result.current.stage).toBe(FlowStage.PLAYING);
  });

  it('a LATER round (new idx after a reveal) shows the brief round-start flash, then playing', async () => {
    const { result, rerender } = renderHook(({ p }) => useMissingLettersFlow(p), {
      initialProps: { p: patch({ phase: 'round', idx: 0 }) },
    });
    expect(result.current.stage).toBe(FlowStage.PLAYING);
    rerender({ p: patch({ phase: 'reveal', idx: 0, revealSeconds: 1 }) });
    rerender({ p: patch({ phase: 'round', idx: 1 }) });
    expect(result.current.stage).toBe(FlowStage.ROUND_START);
    await waitFor(() => expect(result.current.stage).toBe(FlowStage.PLAYING), { timeout: 2000 });
  });

  it('does NOT reset the stage on same-round score-tick patches', async () => {
    const { result, rerender } = renderHook(({ p }) => useMissingLettersFlow(p), {
      initialProps: { p: patch({ phase: 'round', idx: 0 }) },
    });
    await waitFor(() => expect(result.current.stage).toBe(FlowStage.PLAYING), { timeout: 2000 });
    // a repeat round patch (same idx) — e.g. another player's score updates — must stay on playing.
    rerender({ p: patch({ phase: 'round', idx: 0, board: [{ playerId: 'a', points: 10 }] }) });
    expect(result.current.stage).toBe(FlowStage.PLAYING);
  });

  it('reveal phase → reveal stage, then round_scores after the reveal window', async () => {
    const { result, rerender } = renderHook(({ p }) => useMissingLettersFlow(p), {
      initialProps: { p: patch({ phase: 'round', idx: 0 }) },
    });
    await waitFor(() => expect(result.current.stage).toBe(FlowStage.PLAYING), { timeout: 2000 });
    rerender({ p: patch({ phase: 'reveal', idx: 0, revealSeconds: 1, answer: 'BANANA' }) });
    expect(result.current.stage).toBe(FlowStage.REVEAL);
    await waitFor(() => expect(result.current.stage).toBe(FlowStage.ROUND_SCORES), { timeout: 2000 });
  });

  it('done phase → done stage', () => {
    const { result, rerender } = renderHook(({ p }) => useMissingLettersFlow(p), {
      initialProps: { p: patch({ phase: 'round', idx: 0 }) },
    });
    rerender({ p: patch({ phase: 'done', idx: 5 }) });
    expect(result.current.stage).toBe(FlowStage.DONE);
  });

  it('intro advance() steps to countdown but never forces playing (backend does)', () => {
    const { result } = renderHook(() => useMissingLettersFlow(null));
    act(() => result.current.advance());
    expect(result.current.stage).toBe(FlowStage.COUNTDOWN);
    act(() => result.current.advance());
    // still countdown — only a backend patch moves past it
    expect(result.current.stage).toBe(FlowStage.COUNTDOWN);
  });
});
