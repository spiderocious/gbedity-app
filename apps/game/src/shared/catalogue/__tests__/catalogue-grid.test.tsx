import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CatalogueGrid } from '../catalogue-grid.tsx';
import type { CatalogueGame } from '../catalogue.types.ts';

// The dynamic-filter rule (locked): category chips render ONLY when the UNFILTERED total > 10 —
// gated on the original games.length, not the filtered count. ≤10 → no filter UI.

const game = (id: number): CatalogueGame => ({
  id,
  gameId: `g_${id}`,
  key: `g-${id}`,
  category: 'casual',
  mode: 'simultaneous',
  title: `Game ${id}`,
  description: 'desc',
  estMinutes: 5,
  players: { min: 2, max: null, recommendedMax: 10 },
  meta: '2–10 · 5m',
  iconName: 'Target',
});

const makeGames = (n: number): CatalogueGame[] => Array.from({ length: n }, (_, i) => game(i + 1));

describe('CatalogueGrid dynamic filters', () => {
  it('hides the filter chips when there are 10 or fewer games', () => {
    render(<CatalogueGrid games={makeGames(10)} onPick={vi.fn()} />);
    expect(screen.queryByRole('group', { name: /filter games/i })).toBeNull();
  });

  it('shows the filter chips when there are more than 10 games', () => {
    render(<CatalogueGrid games={makeGames(11)} onPick={vi.fn()} />);
    expect(screen.getByRole('group', { name: /filter games/i })).toBeInTheDocument();
  });

  it('calls onPick with the chosen game', async () => {
    const onPick = vi.fn();
    render(<CatalogueGrid games={makeGames(3)} onPick={onPick} />);
    // GameTile renders an interactive element with the title; click the first.
    screen.getByText('Game 1').closest('button, [role="button"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0]?.id).toBe(1);
  });
});
