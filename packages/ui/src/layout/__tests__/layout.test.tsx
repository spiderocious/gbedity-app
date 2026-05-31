import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Column, Row } from '../layout.tsx';

describe('Row', () => {
  it('renders a horizontal flex container with its children', () => {
    render(
      <Row data-testid="row">
        <span>a</span>
        <span>b</span>
      </Row>,
    );
    const el = screen.getByTestId('row');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('flex', 'flex-row', 'gap-0');
    expect(el).toHaveTextContent('ab');
  });

  it('maps gap / align / justify tokens to grid classes', () => {
    render(<Row data-testid="row" gap="3" align="center" justify="between" />);
    expect(screen.getByTestId('row')).toHaveClass(
      'gap-3',
      'items-center',
      'justify-between',
    );
  });

  it('toggles wrap and inline', () => {
    render(<Row data-testid="row" wrap inline />);
    const el = screen.getByTestId('row');
    expect(el).toHaveClass('inline-flex', 'flex-wrap');
    expect(el).not.toHaveClass('flex');
  });

  it('renders as a semantic element via `as`', () => {
    render(
      <Row as="nav" aria-label="Main" data-testid="row">
        x
      </Row>,
    );
    const el = screen.getByTestId('row');
    expect(el.tagName).toBe('NAV');
    expect(el).toHaveAttribute('aria-label', 'Main');
  });

  it('forwards className and arbitrary props', () => {
    render(<Row data-testid="row" className="custom-x" id="my-row" />);
    const el = screen.getByTestId('row');
    expect(el).toHaveClass('custom-x');
    expect(el).toHaveAttribute('id', 'my-row');
  });
});

describe('Column', () => {
  it('renders a vertical flex container', () => {
    render(<Column data-testid="col" gap="4" />);
    const el = screen.getByTestId('col');
    expect(el).toHaveClass('flex', 'flex-col', 'gap-4');
  });
});
