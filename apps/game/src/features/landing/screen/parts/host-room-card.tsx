import { useState } from 'react';

import { Button, Card, DrawerService } from '@gbedity/ui';
import { ArrowRight } from '@icons';

import { CurtainTransition } from './curtain-transition.tsx';

// C (host half) — one decision: start a room. The Quick Play / Create Game / League fork
// lives inside the host flow, not here — the landing shouldn't ask for a strategic choice
// before the host has seen the product. Starting a room plays the Stage Cobalt curtain
// (the brand's "entering the product" motion) into a placeholder until the host route
// exists. Bare UI: no room is created.
export function HostRoomCard() {
  const [curtain, setCurtain] = useState(false);

  return (
    <Card size="lg" className="flex flex-col" data-monkey-perch>
      <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        Host a room
      </p>
      <h2 className="mt-1 font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
        Start the night
      </h2>
      <p className="mt-1 font-sans text-[14px] leading-[1.5] text-ink-3">
        Open a room here, put it on a screen the room can see, share the code. Players join
        from their phones.
      </p>

      <div className="mt-auto pt-6">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
          onClick={() => setCurtain(true)}
        >
          Start a room
        </Button>
      </div>

      <CurtainTransition
        active={curtain}
        onMidpoint={() => DrawerService.toast('Hosting is coming soon.', { tone: 'info' })}
        onDone={() => setCurtain(false)}
      />
    </Card>
  );
}
