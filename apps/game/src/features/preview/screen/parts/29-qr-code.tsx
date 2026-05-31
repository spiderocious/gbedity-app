import { QrCode } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function QrCodePart() {
  return (
    <div>
      <PageHead index="29 / DISPLAY" title="QrCode" subtitle="@gbedity/ui · qr-code" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        A brand-styled QR for join surfaces — the host dashboard and the display screen show
        it so players can scan to join. Forest Ink modules on a white card (no pure black).
        Wraps the QR engine so it can be swapped in one place.
      </p>

      <RefBlock title="Sizes">
        <RefRow label="sm · 96">
          <QrCode url="https://gbedity.app/join/GBE4ZK" size={96} />
        </RefRow>
        <RefRow label="md · 160 (default)">
          <QrCode url="https://gbedity.app/join/GBE4ZK" />
        </RefRow>
        <RefRow label="lg · 220">
          <QrCode url="https://gbedity.app/join/GBE4ZK" size={220} />
        </RefRow>
      </RefBlock>
    </div>
  );
}
