import { useEffect } from 'react';

import { Button, Score, SoundKey, useSound } from '@gbedity/ui';
import { Check, X } from '@icons';

import { LetterSlots, SlotTone } from '../ui/letter-slots.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';

// SCORES — the per-round result slide. Shows whether the last guess was correct, reveals the answer,
// and the points earned THIS round (the running total lives on the final-score screen, not here).
// Two actions: continue or exit. Plays a win / error cue on mount based on correctness.

interface ScoresScreenProps {
  readonly correct: boolean;
  readonly answer: string;
  readonly pointsEarned: number;
  readonly roundIndex: number; // 0-based
  readonly rounds: number;
  readonly onContinue: () => void;
  readonly onExit: () => void;
  /** Multiplayer: the engine times reveal→next, so the player has no Continue/Exit here. Hide them
   *  and show a "next round coming up" beat instead. Defaults to interactive (solo). */
  readonly actions?: boolean;
  /** Optional caption under the score in MP mode (e.g. "Next round coming up…"). */
  readonly caption?: string;
}

export function ScoresScreen({
  correct,
  answer,
  pointsEarned,
  roundIndex,
  rounds,
  onContinue,
  onExit,
  actions = true,
  caption,
}: ScoresScreenProps) {
  const { play } = useSound();

  useEffect(() => {
    play(correct ? SoundKey.ROUND_WIN : SoundKey.ERROR);
  }, [correct, play]);

  const tone = correct ? SlideTone.ACTION : SlideTone.CANVAS;
  const headline = correct ? 'Nice — you got it.' : 'Not this time.';
  const revealMask = answer.split('').join(' ');

  // On the green (correct) slide every label/number is solid white; on the canvas (wrong) slide it's
  // forest ink. No faint /80 — small caps need full contrast.
  const label = correct ? 'text-surface' : 'text-ink-3';
  const heading = correct ? 'text-surface' : 'text-ink';

  return (
    <SlideFrame tone={tone} animateKey={`${roundIndex}-${correct}`}>
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        {/* Verdict badge */}
        <span
          aria-hidden="true"
          className={`inline-flex h-16 w-16 items-center justify-center rounded-full ${
            correct ? 'bg-surface/25 text-surface' : 'bg-danger-soft text-danger'
          }`}
        >
          {correct ? <Check size={32} /> : <X size={32} />}
        </span>

        <h1 className={`font-serif text-[34px] font-semibold tracking-[-0.01em] sm:text-[44px] ${heading}`}>
          {headline}
        </h1>

        {/* The answer, revealed */}
        <div className="flex flex-col items-center gap-2">
          <span className={`font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] ${label}`}>
            The word was
          </span>
          <LetterSlots masked={revealMask} tone={correct ? SlotTone.ON_DARK : SlotTone.ON_LIGHT} size="md" />
        </div>

        {/* Points earned this round only */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] ${label}`}>
            This round
          </span>
          <Score value={pointsEarned} size="hero" tone="light" unit="pts" />
        </div>

        <span className={`font-sans text-[14px] font-semibold ${label}`}>
          Round {roundIndex + 1} of {rounds}
        </span>

        {/* Actions (solo) — or a timed "next round" beat (multiplayer, engine-paced). */}
        {actions ? (
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant={correct ? 'secondary' : 'primary'} size="lg" className="w-full sm:w-auto" onClick={onContinue}>
              Continue playing
            </Button>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onExit}>
              Exit
            </Button>
          </div>
        ) : (
          <span className={`mt-2 font-sans text-[14px] ${label}`}>{caption ?? 'Next round coming up…'}</span>
        )}
      </div>
    </SlideFrame>
  );
}
