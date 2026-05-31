import { Button, Card } from '@gbedity/ui';
import { ArrowRight } from '@icons';

import { ROUTES } from '../../../../shared/constants/routes.ts';
import { useStageNav } from '../../../../shared/widgets/use-stage-nav.tsx';

// C (host half) — per screens-spec §1.1: a single "Start a room" CTA. The three modes
// (Quick Play / Create Game / League Play) live on /host/new (§1.5), not the landing.
// Starting plays the Stage Cobalt curtain into the host start screen.
export function HostRoomCard() {
  const { go, curtain } = useStageNav();

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
          onClick={() => go(ROUTES.HOST_NEW)}
        >
          Start a room
        </Button>
      </div>
      {curtain}
    </Card>
  );
}
