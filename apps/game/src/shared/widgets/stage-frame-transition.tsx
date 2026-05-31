import { useRef } from 'react';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

// §8.6 — the Stage Cobalt curtain wipe for "entering the product" transitions (join a
// room, start a game, advance a league). A cobalt panel wipes across, fires onMidpoint at
// full cover (navigate here), then wipes off and fires onDone. Reduced-motion: skip the
// animation, fire both callbacks immediately.

interface StageFrameTransitionProps {
  readonly active: boolean;
  readonly onMidpoint: () => void;
  readonly onDone: () => void;
}

const COVER_S = 0.35;

export function StageFrameTransition({ active, onMidpoint, onDone }: StageFrameTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!active) return;
      const el = ref.current;
      if (el === null) return;

      const reduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced) {
        onMidpoint();
        onDone();
        return;
      }

      gsap
        .timeline()
        .set(el, { display: 'block', xPercent: -100 })
        .to(el, { xPercent: 0, duration: COVER_S, ease: 'power2.in' })
        .add(() => onMidpoint())
        .to(el, { xPercent: 100, duration: COVER_S, ease: 'power2.out' })
        .set(el, { display: 'none' })
        .add(() => onDone());
    },
    { dependencies: [active] },
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] hidden bg-stage"
    />
  );
}
