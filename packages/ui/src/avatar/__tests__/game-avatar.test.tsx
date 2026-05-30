import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GameAvatar } from '../game-avatar.tsx';
import { generateDicebearSvg } from '../helpers/generate-dicebear-svg.ts';

vi.mock('../helpers/generate-dicebear-svg.ts', () => ({
  generateDicebearSvg: vi.fn(),
}));

const mockedGenerate = vi.mocked(generateDicebearSvg);

afterEach(() => {
  vi.clearAllMocks();
});

describe('GameAvatar', () => {
  it('renders the DiceBear image when generation succeeds', () => {
    mockedGenerate.mockReturnValue('data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E');

    render(<GameAvatar id="temi" label="Temi" />);

    const img = screen.getByRole('img', { name: 'Temi' });
    expect(img).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
  });

  it('is decorative (aria-hidden, empty alt) when no label is given', () => {
    mockedGenerate.mockReturnValue('data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E');

    const { container } = render(<GameAvatar id="temi" />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('alt', '');
  });

  it('falls back to the initial Avatar when generation returns null', () => {
    mockedGenerate.mockReturnValue(null);

    const { container } = render(<GameAvatar id="temi" />);

    expect(container.querySelector('img')).toBeNull();
    // Initial derived from the id ("temi" -> "T").
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('falls back to the initial Avatar when the image fails to load', () => {
    mockedGenerate.mockReturnValue('data:image/svg+xml;utf8,broken');

    const { container } = render(<GameAvatar id="ada" />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('honours an explicit initial override on fallback', () => {
    mockedGenerate.mockReturnValue(null);

    render(<GameAvatar id="temi" initial="Z" />);

    expect(screen.getByText('Z')).toBeInTheDocument();
  });
});
