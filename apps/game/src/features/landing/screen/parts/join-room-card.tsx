import { useState } from 'react';

import { Button, Card, DrawerService, Field, RoomCodeInput } from '@gbedity/ui';
import { ArrowRight, Keyboard, QrCode } from '@icons';
import { QRCodeSVG } from 'qrcode.react';

// C (join half) — enter a room code to join, or flip to a scannable QR. Per PRD §10 the
// landing captures only the code; nickname is the next screen. Bare UI: the code value is
// controlled for demo, the QR encodes a placeholder join URL, and Join carries no real
// logic yet (toast placeholder until the join feature is wired).

const PLACEHOLDER_JOIN_URL = 'https://gbedity.app/join';

// Brand: Forest Ink modules on white, per the no-pure-black rule.
const QR_FG = '#1F6B4A';
const QR_BG = '#FFFFFF';

const ViewMode = {
  CODE: 'code',
  QR: 'qr',
} as const;
type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export function JoinRoomCard() {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<ViewMode>(ViewMode.CODE);
  const trimmed = code.trim();
  const showingQr = mode === ViewMode.QR;

  function handleJoin() {
    DrawerService.toast('Joining a room is coming soon.', { tone: 'info' });
  }

  return (
    <Card size="lg" className="flex flex-col" data-monkey-perch>
      <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        Join a room
      </p>
      <h2 className="mt-1 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
        Got a code?
      </h2>
      <p className="mt-1 font-sans text-[14px] leading-[1.5] text-ink-3">
        Type the six characters from the shared screen — or scan the QR.
      </p>

      {showingQr ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-card bg-canvas px-4 py-6">
          <span className="rounded-[16px] bg-surface p-4">
            <QRCodeSVG value={PLACEHOLDER_JOIN_URL} size={148} fgColor={QR_FG} bgColor={QR_BG} />
          </span>
          <p className="text-center font-sans text-[13px] font-semibold text-ink-3">
            Scan this with your phone camera to join.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <Field label="Room code" htmlFor="room-code">
            <RoomCodeInput
              id="room-code"
              value={code}
              placeholder="GBE-4ZK"
              className="max-w-none"
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!showingQr && trimmed === ''}
          trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
          onClick={handleJoin}
        >
          Join room
        </Button>
        {showingQr ? (
          <Button
            variant="ghost"
            leadingIcon={<Keyboard size={18} aria-hidden="true" />}
            onClick={() => setMode(ViewMode.CODE)}
          >
            Back to code
          </Button>
        ) : (
          <Button
            variant="ghost"
            leadingIcon={<QrCode size={18} aria-hidden="true" />}
            onClick={() => setMode(ViewMode.QR)}
          >
            Show QR instead
          </Button>
        )}
      </div>
    </Card>
  );
}
