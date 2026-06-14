import { useEffect, useRef } from 'react';

import { Button, SoundKey, useSound } from '@gbedity/ui';
import { Home, RotateCcw } from '@icons';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { ConfettiBurst } from '../ui/confetti-burst.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';

// FINAL SCORE — the end-of-game celebration slide. Reusable pattern: confetti, an emoji band based
// on performance ratio, the big white final score, a summary pill, Replay / Home. Plays win fanfare.

interface FinalScoreScreenProps {
  readonly totalScore: number;
  readonly correctCount: number;
  readonly rounds: number;
  readonly onReplay: () => void;
  readonly onHome: () => void;
}

const band = (ratio: number): { emoji: string; headline: string } => {
  if (ratio >= 0.85) return { emoji: '🏆', headline: 'Outstanding!' };
  if (ratio >= 0.6) return { emoji: '🎉', headline: 'Great run!' };
  if (ratio >= 0.3) return { emoji: '👏', headline: 'Nice one.' };
  return { emoji: '🌱', headline: 'Good start.' };
};

export function FinalScoreScreen({
  totalScore,
  correctCount,
  rounds,
  onReplay,
  onHome,
}: FinalScoreScreenProps) {
  const { play } = useSound();
  const stack = useRef<HTMLDivElement>(null);
  const emojiEl = useRef<HTMLSpanElement>(null);

  const ratio = rounds > 0 ? correctCount / rounds : 0;
  const { emoji: face, headline } = band(ratio);

  useEffect(() => {
    play(SoundKey.ROUND_WIN);
  }, [play]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      if (emojiEl.current) {
        gsap.fromTo(
          emojiEl.current,
          { scale: 0, rotate: -25 },
          { scale: 1, rotate: 0, duration: 0.7, ease: EASE_SPRING, delay: 0.15 },
        );
        gsap.to(emojiEl.current, { y: -10, duration: 1.4, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.9 });
      }
      if (stack.current) {
        gsap.fromTo(
          stack.current.querySelectorAll('[data-stagger]'),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.12, delay: 0.35 },
        );
      }
    },
    { dependencies: [] },
  );

  return (
    <>
      <ConfettiBurst />
      <SlideFrame tone={SlideTone.ACTION}>
        <div ref={stack} className="flex w-full max-w-xl flex-col items-center gap-5">
          <span ref={emojiEl} className="text-[72px] leading-none sm:text-[88px]" role="img" aria-label={headline}>
            {face}
          </span>

          <div data-stagger className="flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
              Wordshot · Final score
            </span>
            <h1 className="font-serif text-[40px] font-semibold tracking-[-0.01em] text-surface sm:text-[52px]">
              {headline}
            </h1>
          </div>

          {/* Big final number — white on green, hand-rolled (not Score component) */}
          <div data-stagger className="flex flex-col items-center">
            <span className="font-serif text-[72px] font-semibold leading-none tabular-nums text-surface sm:text-[96px]">
              {totalScore}
              <span className="ml-2 align-baseline font-sans text-[24px] font-bold text-surface/90">pts</span>
            </span>
          </div>

          <span data-stagger className="rounded-full bg-surface/20 px-4 py-1.5 font-sans text-[14px] font-bold text-surface">
            {correctCount} of {rounds} correct
          </span>

          <div data-stagger className="mt-3 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={onReplay}
              leadingIcon={<RotateCcw size={18} aria-hidden="true" />}
            >
              Play again
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
              onClick={onHome}
              leadingIcon={<Home size={18} aria-hidden="true" />}
            >
              Home
            </Button>
          </div>
        </div>
      </SlideFrame>
    </>
  );
}
