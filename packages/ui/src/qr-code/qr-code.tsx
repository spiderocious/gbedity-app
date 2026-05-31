import { QRCodeSVG } from 'qrcode.react';

import { cn } from '../utils/cn.ts';

export interface QrCodeProps {
  /** The value to encode — typically a room join URL. */
  url: string;
  /** Pixel size of the (square) code. Default 160. */
  size?: number;
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

export function QrCode({ url, size = 160, className }: Readonly<QrCodeProps>) {
  return (
    <span className={cn('inline-flex rounded-card bg-surface p-4', className)}>
      <QRCodeSVG value={url} size={size} fgColor={QR_FG} bgColor={QR_BG} level="M" />
    </span>
  );
}
