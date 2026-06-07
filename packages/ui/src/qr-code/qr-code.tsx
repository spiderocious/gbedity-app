import { QRCodeSVG } from 'qrcode.react';

import { cn } from '../utils/cn.ts';

export interface QrCodeProps {
  /** The value to encode — typically a room join URL. */
  url: string;
  /** Pixel size of the (square) code. Default 160. */
  size?: number;
  /**
   * Fill the wrapper's width instead of using a fixed `size` — the SVG scales to its container
   * (height follows, staying square). Use when the QR should fill its card.
   */
  fluid?: boolean;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/branding.md (brand surfaces)
//
// QrCode — a brand-styled QR for join/display surfaces (host dashboard shows it; the
// display screen shows it for players to scan — PRD §4, §5). Forest Ink modules on a white
// card, per the no-pure-black rule. Wraps qrcode.react so the QR engine can be swapped in
// one place. Decorative framing only — the encoded value carries the meaning.
const QR_FG = '#1F6B4A'; // Forest Ink — never pure black
const QR_BG = '#FFFFFF';

export function QrCode({ url, size = 160, fluid = false, className }: Readonly<QrCodeProps>) {
  return (
    <span className={cn('inline-flex rounded-card bg-surface p-4', fluid ? 'w-full' : '', className)}>
      <QRCodeSVG
        value={url}
        size={size}
        fgColor={QR_FG}
        bgColor={QR_BG}
        level="M"
        {...(fluid ? { style: { width: '100%', height: 'auto' } } : {})}
      />
    </span>
  );
}
