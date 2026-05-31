import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RealGameId } from '../../../shared/types/api.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';
import { getLiveRenderer } from '../live/live-renderers.tsx';

// Regression for "Rendered more hooks than during the previous render": the player renderers
// use useState and were previously CALLED as functions (renderer.player(patch)), so a changing
// patch shape changed the hook count and crashed. They're now components — re-rendering one
// across wildly different patch shapes must NOT throw.

const PATCHES: ViewPatch[] = [
  { phase: 'question', qIndex: 0, rounds: 10, prompt: 'Q?', options: ['a', 'b', 'c', 'd'] },
  { phase: 'question', qIndex: 1, rounds: 10, prompt: 'Q2?' }, // no options (shape shrank)
  { phase: 'reveal', qIndex: 1, rounds: 10 }, // different phase, fewer fields
  { phase: 'question', qIndex: 2, rounds: 10, prompt: 'Q3?', options: ['x', 'y'], answered: true },
];

describe('live player renderer is a stable component (no hook-count crash)', () => {
  it('re-renders the quizzes Player across changing patch shapes without throwing', () => {
    const renderer = getLiveRenderer(RealGameId.QUIZZES);
    expect(renderer).toBeDefined();
    const Player = renderer!.Player;
    const send = vi.fn();

    const first = PATCHES[0]!;
    const { rerender, container } = render(<Player patch={first} send={send} />);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);

    // The crash reproduced on the SECOND render with a different shape — assert it's fine.
    for (const patch of PATCHES.slice(1)) {
      expect(() => rerender(<Player patch={patch} send={send} />)).not.toThrow();
    }
  });

  it('every real game exposes a Player component and a display fn', () => {
    for (const id of Object.values(RealGameId)) {
      const r = getLiveRenderer(id);
      expect(r?.Player).toBeTypeOf('function');
      expect(r?.display).toBeTypeOf('function');
    }
  });
});
