import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrangeWinnerBar } from '../winner-bar.tsx';

describe('OrangeWinnerBar', () => {
  it('renders name, score, and default label', () => {
    render(<OrangeWinnerBar name="Ada" score={1420} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('1420')).toBeInTheDocument();
    expect(screen.getByText('Winner')).toBeInTheDocument();
  });

  it('honours a custom label and unit', () => {
    render(<OrangeWinnerBar name="Ada" score={1420} label="Top scorer" unit="pts" />);
    expect(screen.getByText('Top scorer')).toBeInTheDocument();
    expect(screen.getByText('pts')).toBeInTheDocument();
  });
});
