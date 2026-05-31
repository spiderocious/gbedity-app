import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QrCode } from '../qr-code.tsx';

describe('QrCode', () => {
  it('renders an SVG QR for the given url', () => {
    const { container } = render(<QrCode url="https://gbedity.app/join/GBE4ZK" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('honours a custom size', () => {
    const { container } = render(<QrCode url="https://gbedity.app/join/GBE4ZK" size={96} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('height', '96');
    expect(svg).toHaveAttribute('width', '96');
  });

  it('forwards className to the frame', () => {
    const { container } = render(
      <QrCode url="https://gbedity.app/join/GBE4ZK" className="custom-x" />,
    );
    expect(container.querySelector('.custom-x')).not.toBeNull();
  });
});
