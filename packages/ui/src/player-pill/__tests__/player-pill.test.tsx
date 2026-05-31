import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlayerPill } from '../player-pill.tsx';

describe('PlayerPill', () => {
  it('renders name and meta', () => {
    render(<PlayerPill name="Funmi" meta="joined 4s ago" />);
    expect(screen.getByText('Funmi')).toBeInTheDocument();
    expect(screen.getByText('joined 4s ago')).toBeInTheDocument();
  });

  it('shows (you) when isYou and no tag', () => {
    render(<PlayerPill name="Funmi" isYou />);
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('renders a custom tag instead of (you)', () => {
    render(<PlayerPill name="Tobi" isYou tag="(you · host)" />);
    expect(screen.getByText('(you · host)')).toBeInTheDocument();
    expect(screen.queryByText('(you)')).toBeNull();
  });

  it('renders trailing content', () => {
    render(<PlayerPill name="Ada" trailing={<span>menu</span>} />);
    expect(screen.getByText('menu')).toBeInTheDocument();
  });
});
