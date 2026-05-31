import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoomCodeChip } from '../room-code-chip.tsx';

describe('RoomCodeChip', () => {
  it('renders the code', () => {
    render(<RoomCodeChip code="GBE-4ZK" />);
    expect(screen.getByText('GBE-4ZK')).toBeInTheDocument();
  });

  it('applies size class', () => {
    render(<RoomCodeChip code="GBE-4ZK" size="hero" data-testid="chip" />);
    expect(screen.getByText('GBE-4ZK')).toHaveClass('text-[44px]');
  });
});
