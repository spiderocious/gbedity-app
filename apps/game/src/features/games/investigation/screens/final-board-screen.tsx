import { useEffect, useRef } from 'react';

import { Button, LeaderboardRows, OrangeWinnerBar, SoundKey, useSound, type LeaderboardEntry } from '@gbedity/ui';
import { Home, RotateCcw } from '@icons';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import { ConfettiBurst } from '../ui/confetti-burst.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { EASE_SPRING, prefersReducedMotion } from '../ui/motion.ts';

// FINAL BOARD — the detective leaderboard. Confetti, the Top Detective banner (who cracked it,
// fastest), the full standings, and Replay / Home. Reusable end pattern. Pure UI.

export interface DetectiveRow {
  readonly name: string;
  readonly score: number;
  readonly detail?: string; // e.g. "correct · 2nd fastest"
  readonly seat?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

interface FinalBoardScreenProps {
  readonly rows: readonly DetectiveRow[]; // already in finishing order
  readonly onReplay: () => void;
  readonly onHome: () => void;
}

export function FinalBoardScreen({ rows, onReplay, onHome }: FinalBoardScreenProps) {
  const { play } = useSound();
  const stack = useRef<HTMLDivElement>(null);
  const top = rows[0];

  useEffect(() => {
    play(SoundKey.ROUND_WIN);
  }, [play]);

  useGSAP(
    () => {
      const el = stack.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el.querySelectorAll('[data-stagger]'),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: EASE_SPRING, stagger: 0.1, delay: 0.3 },
      );
    },
    { dependencies: [] },
  );

  const entries: LeaderboardEntry[] = rows.map((r) => ({
    name: r.name,
    score: r.score,
    ...(r.seat !== undefined ? { seat: r.seat } : {}),
    ...(r.detail !== undefined ? { detail: r.detail } : {}),
  }));

  return (
    <>
      <ConfettiBurst />
      <SlideFrame tone={SlideTone.ACTION} compact>
        <div ref={stack} className="flex w-full max-w-lg flex-col items-center gap-5">
          <span data-stagger className="text-[56px] leading-none" role="img" aria-label="Top detective">
            🕵️
          </span>
          <div data-stagger className="flex flex-col items-center gap-1 text-center">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">Case closed · Top detective</span>
            <h1 className="font-serif text-[34px] font-semibold tracking-[-0.01em] text-surface sm:text-[44px]">
              {top?.name ?? 'Nobody cracked it'}
            </h1>
          </div>

          {top !== undefined ? (
            <div data-stagger className="w-full">
              <OrangeWinnerBar name={top.name} score={top.score} {...(top.seat !== undefined ? { seat: top.seat } : {})} label="cracked it" unit="pts" />
            </div>
          ) : null}

          <div data-stagger className="w-full rounded-[20px] bg-surface px-4 py-3">
            <LeaderboardRows entries={entries} />
          </div>

          <div data-stagger className="mt-2 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={onReplay} leadingIcon={<RotateCcw size={18} aria-hidden="true" />}>
              New case
            </Button>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onHome} leadingIcon={<Home size={18} aria-hidden="true" />}>
              Home
            </Button>
          </div>
        </div>
      </SlideFrame>
    </>
  );
}
