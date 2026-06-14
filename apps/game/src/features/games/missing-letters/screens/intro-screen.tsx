import { useEffect, useRef } from 'react';

import { Button, SoundKey, useSound } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';

// INTRO — the opening slide. Full-screen brand-green poster panel (via SlideFrame) with a centred,
// bouncing-in title + a "Start" CTA. Pure UI: the caller passes the round count and an onStart
// handler. Plays the game-start fanfare on mount.

interface IntroScreenProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly rounds?: number;
  readonly onStart: () => void;
}

export function IntroScreen({
  title = 'Missing Letters',
  subtitle = 'Fill the gaps before the clock runs out.',
  rounds,
  onStart,
}: IntroScreenProps) {
  const { play } = useSound();
  const stack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    play(SoundKey.GAME_START);
  }, [play]);

  useGSAP(
    () => {
      const el = stack.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el.querySelectorAll('[data-stagger]'),
        { opacity: 0, y: 28, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: EASE_SPRING, stagger: 0.12, delay: 0.25 },
      );
    },
    { dependencies: [] },
  );

  return (
    <SlideFrame tone={SlideTone.ACTION}>
      <div ref={stack} className="flex flex-col items-center gap-6">
        <span data-stagger className="font-sans text-[13px] font-extrabold uppercase tracking-[0.18em] text-surface/80">
          Solo · {rounds ? `${rounds} rounds` : 'Get ready'}
        </span>
        <h1 data-stagger className="max-w-2xl font-serif text-[44px] font-semibold leading-[1.05] tracking-[-0.01em] text-surface sm:text-[72px]">
          {title}
        </h1>
        <p data-stagger className="max-w-md font-sans text-[17px] leading-[1.5] text-surface/90 sm:text-[19px]">
          {subtitle}
        </p>
        <div data-stagger className="mt-2">
          <Button variant="secondary" size="lg" onClick={onStart} clickSound>
            Start
          </Button>
        </div>
      </div>
    </SlideFrame>
  );
}
