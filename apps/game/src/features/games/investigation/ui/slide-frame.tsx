import { useRef, type ReactNode } from 'react';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { cn } from '@gbedity/ui';

import { EASE_SPRING, prefersReducedMotion } from './motion.ts';

// The signature Missing Letters "slide": an inset, rounded, brand-coloured panel that sits on the
// canvas like a poster frame (NOT edge-to-edge) and BOUNCES in on mount. Every ML screen is built
// inside one of these so the whole game reads as a deck of slides. Pure presentation — the caller
// owns what goes inside and which tone.

// Tone = the slide's fill. action(green) is the default brand opener; others theme per phase.
export const SlideTone = {
  ACTION: 'action',
  CANVAS: 'canvas',
  ACCENT: 'accent',
  STAGE: 'stage',
} as const;
export type SlideTone = (typeof SlideTone)[keyof typeof SlideTone];

const TONE_CLASS: Record<SlideTone, string> = {
  [SlideTone.ACTION]: 'bg-action text-surface',
  [SlideTone.CANVAS]: 'bg-canvas text-ink',
  [SlideTone.ACCENT]: 'bg-accent text-surface',
  [SlideTone.STAGE]: 'bg-stage text-surface',
};

interface SlideFrameProps {
  readonly children: ReactNode;
  readonly tone?: SlideTone;
  /** Replay the bounce when this key changes (e.g. a new round). */
  readonly animateKey?: string | number;
  /** Tighter padding for content-heavy slides (e.g. the question screen) vs sparse hero slides. */
  readonly compact?: boolean;
  readonly className?: string;
}

export function SlideFrame({ children, tone = SlideTone.ACTION, animateKey, compact = false, className }: SlideFrameProps) {
  const panel = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = panel.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        gsap.set(el, { opacity: 1, scale: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.86, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: EASE_SPRING },
      );
    },
    { dependencies: [animateKey] },
  );

  // Outer = full-screen canvas backdrop, centring the slide. Inner = the inset poster panel.
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-4 sm:p-8">
      <div
        ref={panel}
        className={cn(
          'relative flex w-full max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[32px] text-center shadow-[0_24px_64px_rgba(31,107,74,0.18)]',
          compact ? 'px-5 py-10 sm:px-10 sm:py-12' : 'px-6 py-16 sm:px-12 sm:py-24',
          'min-h-[70vh]',
          TONE_CLASS[tone],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
