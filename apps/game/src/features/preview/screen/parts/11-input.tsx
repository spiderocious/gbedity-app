import { useState } from 'react';

import { Button, Field, Input, RoomCodeInput } from '@gbedity/ui';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

export function InputPart() {
  const [room, setRoom] = useState('GBE4ZK'); // raw; RoomCodeInput renders the dashed form
  const [nickname, setNickname] = useState('Funmi');
  const [answer, setAnswer] = useState('');

  return (
    <div>
      <PageHead index="11 / PRIMITIVES" title="Input · Field · RoomCodeInput" subtitle="@gbedity/ui · input" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        The three hero inputs: <strong>room code</strong> (join), <strong>nickname</strong>{' '}
        (lobby), <strong>answer</strong> (in-game). Two-pixel borders, 16px radius. Focus is
        action green; error is tomato red. Field wraps label + control + helper.
      </p>

      <RefBlock title="Join flow · the first inputs a player sees">
        <div className="-mx-[6px] flex flex-col gap-5 px-[6px] py-2">
          <Field label="Room code" helper="Six characters. We've removed easy-to-confuse ones (O, 0, I, 1).">
            <RoomCodeInput value={room} onValueChange={setRoom} />
          </Field>
          <Field label="Nickname" helper="Anything works. Emojis allowed, swearing isn't.">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter a nickname"
            />
          </Field>
          <div>
            <Button>Join Friday game night</Button>
          </div>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="In-game answer input">
        <div className="-mx-[6px] flex flex-col gap-3 px-[6px] py-2 text-center">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            It's your turn
          </p>
          <p className="font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
            Foods · starts with A
          </p>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type a word"
            className="py-5 text-center text-[22px] font-bold"
            autoFocus
          />
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="States">
        <RefRow label="default">
          <Input placeholder="placeholder" />
        </RefRow>
        <RefRow label="focus + value">
          <Input defaultValue="typing…" autoFocus={false} />
        </RefRow>
        <RefRow label="error">
          <Field label="Room code" error="That room code doesn't exist.">
            <Input defaultValue="GBE-XXX" error />
          </Field>
        </RefRow>
        <RefRow label="success">
          <Field label="Nickname" success="Available!">
            <Input defaultValue="Tobi" />
          </Field>
        </RefRow>
        <RefRow label="disabled">
          <Input defaultValue="locked" disabled />
        </RefRow>
      </RefBlock>
    </div>
  );
}
