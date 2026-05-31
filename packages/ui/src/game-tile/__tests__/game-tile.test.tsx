import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GameTile } from '../game-tile.tsx';

const base = {
  id: 6,
  category: 'casual' as const,
  tag: 'Quick',
  title: 'Word Bomb',
  meta: '3–10 · 8m',
  description: 'Hold the bomb longer for more points.',
};

describe('GameTile', () => {
  it('renders title, tag, meta, and description', () => {
    render(<GameTile {...base} />);
    expect(screen.getByText('Word Bomb')).toBeInTheDocument();
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('3–10 · 8m')).toBeInTheDocument();
  });

  it('renders the zero-padded number as the anchor when no icon is given', () => {
    render(<GameTile {...base} />);
    expect(screen.getByText('06')).toBeInTheDocument();
  });

  it('renders the signature icon and still keeps the number as a corner reference', () => {
    render(<GameTile {...base} icon={<svg data-testid="sig" />} />);
    expect(screen.getByTestId('sig')).toBeInTheDocument();
    expect(screen.getByText('06')).toBeInTheDocument();
  });

  it('is a button when onClick is provided, a div otherwise', () => {
    const { rerender } = render(<GameTile {...base} onClick={() => undefined} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<GameTile {...base} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
