import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from '../logo.tsx';

describe('Logo', () => {
  it('renders the full wordmark by default', () => {
    render(<Logo />);
    expect(screen.getByText('Gbedity')).toBeInTheDocument();
  });

  it('renders the single-letter mark in mark variant', () => {
    render(<Logo variant="mark" />);
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.queryByText('Gbedity')).toBeNull();
  });

  it('applies the size class', () => {
    render(<Logo size="lg" data-testid="logo" />);
    expect(screen.getByTestId('logo')).toHaveClass('text-[42px]');
  });

  it('forwards className and arbitrary props', () => {
    render(<Logo className="custom-x" aria-label="Gbedity home" data-testid="logo" />);
    const el = screen.getByTestId('logo');
    expect(el).toHaveClass('custom-x');
    expect(el).toHaveAttribute('aria-label', 'Gbedity home');
  });
});
