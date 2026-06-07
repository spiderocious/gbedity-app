import { useState } from 'react';

import { Button, Card, Field, RoomCodeInput, DrawerService } from '@gbedity/ui';
import { ArrowRight } from '@icons';

import { ROUTES } from '../../../../shared/constants/routes.ts';
import { useStageNav } from '../../../../shared/widgets/use-stage-nav.tsx';
import { isValidRoomCode } from '@gbedity/util'

export function JoinRoomCard() {
  const [code, setCode] = useState('');
  const { go, curtain } = useStageNav();

  function handleJoin() {
    if (!isValidRoomCode(code)) {
      DrawerService.toast('Please enter a valid room code.', { tone: 'danger' });
      return;
    }
    go(`${ROUTES.JOIN}/${code}`);
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

      <div className="mt-5">
        <Field label="Room code" htmlFor="room-code">
          <RoomCodeInput
            id="room-code"
            value={code}
            placeholder="GBE-4ZK"
            className="max-w-none"
            onValueChange={setCode}
          />
        </Field>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
          onClick={handleJoin}
        >
          Join room
        </Button>
        {/* <Button
          variant="ghost"
          leadingIcon={<QrCode size={18} aria-hidden="true" />}
          onClick={() => go(ROUTES.JOIN_QR)}
        >
          Scan QR instead
        </Button> */}
      </div>
      {curtain}
    </Card>
  );
}
