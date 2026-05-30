import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button.js';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Play</Button>);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows a loading label and is disabled while loading', () => {
    render(<Button loading>Play</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Loading…');
  });

  it('applies the variant class', () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('gb-button--ghost');
  });
});
