import { useEffect, useRef } from 'react';

import { Button, GameAvatar, SoundKey, useSound } from '@gbedity/ui';
import { Clock, Users } from '@icons';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';
import type { MockCase } from '../preview/mock-case.ts';

// BRIEFING — the cinematic case opener. The crime, the stakes, the suspect lineup, then "Open the
// case file". Sets the tone (a homicide dossier), bounces in, plays the start cue. Pure UI.

interface BriefingScreenProps {
  readonly theCase: MockCase;
  readonly investigateMinutes?: number;
  readonly onOpen: () => void;
}

export function BriefingScreen({ theCase, investigateMinutes = 5, onOpen }: BriefingScreenProps) {
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
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: EASE_SPRING, stagger: 0.1, delay: 0.2 },
      );
    },
    { dependencies: [] },
  );

  return (
    <SlideFrame tone={SlideTone.STAGE} compact>
      <div ref={stack} className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
        <span data-stagger className="rounded-full bg-surface/15 px-3 py-1 font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
          Case file · {theCase.category}
        </span>
        <h1 data-stagger className="font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-surface sm:text-[60px]">
          {theCase.title}
        </h1>
        <p data-stagger className="max-w-xl font-sans text-[15px] leading-[1.6] text-surface/90 sm:text-[16px]">
          {theCase.brief}
        </p>

        {/* Suspect lineup */}
        <div data-stagger className="flex items-center justify-center -space-x-2">
          {theCase.suspects.map((s) => (
            <GameAvatar key={s.id} id={s.id + s.name} size="md" className="ring-2 ring-stage" />
          ))}
        </div>

        <div data-stagger className="flex items-center gap-4 font-sans text-[13px] font-semibold text-surface/80">
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} aria-hidden="true" /> {theCase.suspects.length} suspects
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} aria-hidden="true" /> {investigateMinutes} min to crack it
          </span>
        </div>

        <div data-stagger className="mt-2">
          <Button variant="celebrate" size="lg" onClick={onOpen}>
            Open the case file
          </Button>
        </div>
      </div>
    </SlideFrame>
  );
}
