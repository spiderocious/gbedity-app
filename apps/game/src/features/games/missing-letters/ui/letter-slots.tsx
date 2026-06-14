import { useRef } from 'react';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { cn } from '@gbedity/ui';

import { EASE_SPRING, prefersReducedMotion } from './motion.ts';

// The word display: one tile per letter. Revealed letters show the character; blanks show an empty
// underlined slot. Accepts the server `masked` string ("b _ n _ n a") OR an explicit char array.
// Pure presentation. Tiles pop in with a stagger when `animateKey` changes.

export const SlotTone = {
  ON_LIGHT: 'on-light', // dark tiles on a white/canvas card
  ON_DARK: 'on-dark', // light tiles on a coloured slide
} as const;
export type SlotTone = (typeof SlotTone)[keyof typeof SlotTone];

interface LetterSlotsProps {
  /** Space-separated mask from the server, e.g. "b _ n _ n a". */
  readonly masked: string;
  readonly tone?: SlotTone;
  readonly size?: 'md' | 'lg';
  readonly animateKey?: string | number;
  readonly className?: string;
}

const parseMask = (masked: string): string[] =>
  masked
    .trim()
    .split(/\s+/)
    .filter((c) => c.length > 0);

export function LetterSlots({ masked, tone = SlotTone.ON_LIGHT, size = 'lg', animateKey, className }: LetterSlotsProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const chars = parseMask(masked);

  useGSAP(
    () => {
      const el = wrap.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el.querySelectorAll('[data-slot]'),
        { opacity: 0, y: 16, scale: 0.7 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: EASE_SPRING, stagger: 0.05 },
      );
    },
    { dependencies: [animateKey, masked] },
  );

  const box =
    size === 'lg'
      ? 'h-16 w-12 text-[34px] sm:h-20 sm:w-16 sm:text-[44px]'
      : 'h-12 w-9 text-[24px] sm:h-14 sm:w-11 sm:text-[30px]';

  const filled = tone === SlotTone.ON_DARK ? 'bg-surface/15 text-surface' : 'bg-canvas text-ink';
  const blank = tone === SlotTone.ON_DARK ? 'border-surface/40 text-surface/60' : 'border-ink-4 text-ink-4';

  return (
    <div ref={wrap} className={cn('flex flex-wrap items-center justify-center gap-2 sm:gap-3', className)}>
      {chars.map((ch, i) => {
        const isBlank = ch === '_';
        return (
          <div
            key={`${i}-${ch}`}
            data-slot
            className={cn(
              'flex items-center justify-center rounded-[16px] font-serif font-semibold uppercase',
              box,
              isBlank ? cn('border-2 border-dashed bg-transparent', blank) : filled,
            )}
          >
            {isBlank ? '' : ch}
          </div>
        );
      })}
    </div>
  );
}
