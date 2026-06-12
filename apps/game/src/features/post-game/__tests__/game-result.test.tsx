import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { resultStore } from '../../../shared/services/result-store.ts';
import { GameResult } from '../game-result.tsx';

// GameResult renders the REAL final board the socket stashed at game-over (not mock data) and a
// "Go to lobby" button that shows the auto-return countdown.

vi.mock('socket.io-client', () => ({
  io: () => ({ on: () => undefined, off: () => undefined, emit: () => undefined, close: () => undefined, removeAllListeners: () => undefined, io: { on: () => undefined } }),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  resultStore.clear('GBE-1');
  document.body.innerHTML = '';
});

describe('GameResult', () => {
  it('renders the stashed final board (real scores, not mock)', () => {
    resultStore.save('GBE-1', {
      code: 'GBE-1',
      rows: [
        { name: 'Ada', score: 1420 },
        { name: 'Tobi', score: 900 },
      ],
    });
    render(wrap(<GameResult code="GBE-1" lobbyRoute={ROUTES.HOST_LOBBY} />));
    // Ada is the winner → appears in the winner bar AND the leaderboard row.
    expect(screen.getAllByText('Ada').length).toBeGreaterThan(0);
    expect(screen.getByText('Tobi')).toBeInTheDocument();
    expect(screen.getAllByText('1420').length).toBeGreaterThan(0);
  });

  it('shows the Go to lobby button with the auto-return countdown', () => {
    resultStore.save('GBE-1', { code: 'GBE-1', rows: [{ name: 'Ada', score: 10 }] });
    render(wrap(<GameResult code="GBE-1" lobbyRoute={ROUTES.HOST_LOBBY} />));
    expect(screen.getByRole('button', { name: /go to lobby · 15s/i })).toBeInTheDocument();
  });

  it('handles an empty/missing board without crashing', () => {
    render(wrap(<GameResult code="GBE-1" lobbyRoute={ROUTES.PLAYER_LOBBY} />));
    expect(screen.getByText(/no scores to show/i)).toBeInTheDocument();
  });
});
