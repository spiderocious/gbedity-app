import { useEffect } from 'react';

import { Button, Score, SoundKey, useSound } from '@gbedity/ui';
import { Check, X } from '@icons';

import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';

// SCORES — per-round result slide. Shows whether the word was valid, points earned this round only
// (no running total here), and an optional fuzzy near-miss suggestion on a wrong answer.
// Two actions: continue or exit. Plays win / error cue on mount.

interface ScoresScreenProps {
  readonly correct: boolean;
  readonly submittedWord: string;
  readonly letter: string;
  readonly category: string;
  readonly pointsEarned: number;
  readonly roundIndex: number;
  readonly rounds: number;
  readonly suggestion?: string;
  readonly onContinue: () => void;
  readonly onExit: () => void;
  // MP additive: hide the Continue/Exit buttons when the engine paces the reveal.
  readonly actions?: boolean;
  // MP additive: timed caption shown instead of buttons ("Next round coming up…").
  readonly caption?: string;
}

export function ScoresScreen({
  correct,
  submittedWord,
  letter,
  category,
  pointsEarned,
  roundIndex,
  rounds,
  suggestion,
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

        {/* What they submitted */}
        <div className="flex flex-col items-center gap-2">
          <span className={`font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] ${label}`}>
            Your word
          </span>
          <span className="font-serif text-[28px] font-semibold tracking-[0.04em] sm:text-[36px]" style={{ color: correct ? '#fff' : undefined }}>
            {submittedWord || '—'}
          </span>
          <span className={`font-sans text-[13px] font-semibold capitalize ${label}`}>
            {letter.toUpperCase()} · {category}
          </span>
        </div>

        {/* Fuzzy suggestion on wrong answer */}
        {!correct && suggestion ? (
          <p className="font-sans text-[14px] text-ink-3">
            Did you mean <span className="font-bold text-ink">{suggestion}</span>?
          </p>
        ) : null}

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

        {/* Actions — hidden in MP (engine paces reveal → next) */}
        {actions ? (
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant={correct ? 'secondary' : 'primary'} size="lg" className="w-full sm:w-auto" onClick={onContinue}>
              Continue playing
            </Button>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onExit}>
              Exit
            </Button>
          </div>
        ) : caption ? (
          <p className={`font-sans text-[14px] font-semibold ${label}`}>{caption}</p>
        ) : null}
      </div>
    </SlideFrame>
  );
}
