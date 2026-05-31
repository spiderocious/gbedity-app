import { useRef } from 'react';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

// The brand's "entering the product" motion — a Stage Cobalt panel wipes across the
// screen (350ms) then off, calling `onMidpoint` at full cover so the caller can navigate
// behind the curtain. Landing-local for now; extract to @gbedity/ui when a second context
// (host / display) needs the same wipe. Reduced-motion: skip the animation, fire the
// callback immediately.

interface CurtainTransitionProps {
  /** When true, play the wipe. Reset to false after `onDone`. */
  readonly active: boolean;
  /** Fired when the curtain fully covers the screen — navigate here. */
  readonly onMidpoint: () => void;
  /** Fired after the curtain has wiped off-screen. */
  readonly onDone: () => void;
}

const COVER_MS = 0.35;

export function CurtainTransition({ active, onMidpoint, onDone }: CurtainTransitionProps) {
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

      const tl = gsap.timeline();
      tl.set(el, { display: 'block', xPercent: -100 })
        .to(el, { xPercent: 0, duration: COVER_MS, ease: 'power2.in' })
        .add(() => onMidpoint())
        .to(el, { xPercent: 100, duration: COVER_MS, ease: 'power2.out' })
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
