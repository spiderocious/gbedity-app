import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeaderboardRows } from '../leaderboard.tsx';

const ENTRIES = [
  { name: 'Ada', score: 1420 },
  { name: 'Tobi', score: 1180 },
  { name: 'Funmi', score: 940 },
];

describe('LeaderboardRows', () => {
  it('renders every entry with derived rank', () => {
    render(<LeaderboardRows entries={ENTRIES} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Tobi')).toBeInTheDocument();
    expect(screen.getByText('Funmi')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders per-row detail when provided', () => {
    render(<LeaderboardRows entries={[{ name: 'Ada', score: 10, detail: 'cited 1 precedent' }]} />);
    expect(screen.getByText('cited 1 precedent')).toBeInTheDocument();
  });
});
