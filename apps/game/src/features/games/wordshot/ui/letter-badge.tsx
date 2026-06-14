import { useRef } from 'react';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { cn } from '@gbedity/ui';

import { EASE_SPRING, prefersReducedMotion } from './motion.ts';

// The hero letter display for the round prompt — a large, bold single letter in a circle.
// Pops in on mount / animateKey change with a spring bounce.

interface LetterBadgeProps {
  readonly letter: string;
  readonly animateKey?: string | number;
  readonly className?: string;
}

export function LetterBadge({ letter, animateKey, className }: LetterBadgeProps) {
  const el = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!el.current || prefersReducedMotion()) return;
      gsap.fromTo(
        el.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: EASE_SPRING },
      );
    },
    { dependencies: [animateKey] },
  );

  return (
    <div
      ref={el}
      className={cn(
        'flex h-28 w-28 items-center justify-center rounded-full bg-surface/20 sm:h-36 sm:w-36',
        className,
      )}
    >
      <span className="font-serif text-[72px] font-semibold uppercase leading-none text-green-600 sm:text-[88px]">
        {letter}
      </span>
    </div>
  );
}
