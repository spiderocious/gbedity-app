import { useEffect, useRef } from 'react';

import { SoundKey, useSound } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SlideFrame, SlideTone } from './slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from './motion.ts';

// COUNTDOWN — the 3·2·1 beat before each question. A big numeral pops on each tick over the green
// slide, with a tick sound. At 0 the caller swaps in the question. Pure UI.

interface CountdownScreenProps {
  readonly count: number; // 3 → 2 → 1 (0 transitions to question)
}

export function CountdownScreen({ count }: CountdownScreenProps) {
  const { play } = useSound();
  const numeral = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (count > 0) play(SoundKey.COUNTDOWN_TICK);
  }, [count, play]);

  useGSAP(
    () => {
      const el = numeral.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: EASE_SPRING });
    },
    { dependencies: [count] },
  );

  return (
    <SlideFrame tone={SlideTone.ACTION}>
      <div className="flex flex-col items-center gap-4">
        <span className="font-sans text-[13px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
          Get ready
        </span>
        <div ref={numeral} className="font-serif text-[120px] font-semibold leading-none text-surface sm:text-[160px]">
          {count > 0 ? count : 'Go'}
        </div>
      </div>
    </SlideFrame>
  );
}
