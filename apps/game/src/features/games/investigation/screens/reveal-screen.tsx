import { useEffect, useRef } from 'react';

import { Button, GameAvatar, SoundKey, cn, useSound } from '@gbedity/ui';
import { Check, X } from '@icons';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';
import type { MockCase } from '../preview/mock-case.ts';

// REVEAL — the payoff. The suspect lineup dims to spotlight the culprit, "The culprit is…" lands,
// then the written explanation of how the evidence proved it. The player sees whether their
// accusation was right and what they scored. Pure UI; `yourSuspectId` is the player's pick.

interface RevealScreenProps {
  readonly theCase: MockCase;
  readonly yourSuspectId: string | null;
  readonly pointsEarned: number;
  readonly onContinue: () => void;
  /** Hide the personal verdict + Continue (spectator/display). */
  readonly readOnly?: boolean;
}

export function RevealScreen({ theCase, yourSuspectId, pointsEarned, onContinue, readOnly }: RevealScreenProps) {
  const { play } = useSound();
  const stack = useRef<HTMLDivElement>(null);
  const correct = yourSuspectId === theCase.solutionSuspectId;
  const culprit = theCase.suspects.find((s) => s.id === theCase.solutionSuspectId);

  useEffect(() => {
    play(readOnly || correct ? SoundKey.ROUND_WIN : SoundKey.ERROR);
  }, [correct, readOnly, play]);

  useGSAP(
    () => {
      const el = stack.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el.querySelectorAll('[data-stagger]'),
        { opacity: 0, y: 24, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: EASE_SPRING, stagger: 0.18, delay: 0.2 },
      );
    },
    { dependencies: [] },
  );

  return (
    <SlideFrame tone={SlideTone.STAGE} compact>
      <div ref={stack} className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
        <span data-stagger className="rounded-full bg-surface/15 px-3 py-1 font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
          The truth
        </span>

        {/* Suspect lineup, culprit spotlit */}
        <div data-stagger className="flex items-end justify-center gap-3">
          {theCase.suspects.map((s) => {
            const guilty = s.id === theCase.solutionSuspectId;
            return (
              <div key={s.id} className={cn('flex flex-col items-center gap-1 transition-opacity', guilty ? 'opacity-100' : 'opacity-30')}>
                <GameAvatar id={s.id + s.name} size={guilty ? 'xl' : 'md'} className={guilty ? 'ring-4 ring-danger' : ''} />
                <span className={cn('font-sans text-[11px] font-bold', guilty ? 'text-surface' : 'text-surface/60')}>
                  {s.name.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        <h1 data-stagger className="font-serif text-[34px] font-semibold leading-tight text-surface sm:text-[46px]">
          It was {culprit?.name}.
        </h1>

        <p data-stagger className="max-w-xl rounded-[18px] bg-surface/10 px-5 py-4 font-sans text-[14px] leading-[1.6] text-surface/90 sm:text-[15px]">
          {theCase.explanation}
        </p>

        {!readOnly ? (
          <div data-stagger className="flex flex-col items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 font-sans text-[15px] font-extrabold',
                correct ? 'bg-action text-surface' : 'bg-danger text-surface',
              )}
            >
              {correct ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
              {correct ? `You cracked it — +${pointsEarned}` : 'Wrong call this time'}
            </span>
            <Button variant="celebrate" size="lg" onClick={onContinue}>
              See final standings
            </Button>
          </div>
        ) : (
          <span data-stagger className="font-sans text-[14px] font-semibold text-surface/80">Final standings coming up…</span>
        )}
      </div>
    </SlideFrame>
  );
}
