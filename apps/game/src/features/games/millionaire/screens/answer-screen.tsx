import { useEffect } from 'react';

import { Button, SoundKey, useSound } from '@gbedity/ui';
import { Check, X } from '@icons';

import { OptionButton, OptionState } from '../ui/option-button.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';
import { formatRung } from '../ui/money-ladder.tsx';

// ANSWER (reveal) — shows whether the player's choice was right or wrong, reveals the correct
// option, and shows what was banked this question. Green slide if correct; canvas if wrong.
// Two CTAs: Continue (next question) or Exit. Wrong answer also shows the "eliminated" state.
// Pure UI: all values are props; caller drives navigation.

interface AnswerScreenProps {
  readonly correct: boolean;
  readonly selectedIdx: number;
  readonly answerIdx: number;
  readonly options: readonly string[];
  readonly rung: number;
  readonly bankedThisQuestion: number;
  readonly questionIdx: number;
  readonly questionCount: number;
  readonly eliminated: boolean;
  readonly onContinue: () => void;
  readonly onExit: () => void;
  readonly autoAdvance?: boolean; // MP: engine times the reveal → next; hide CTAs
  readonly caption?: string;      // MP: "Next question coming up…"
}

export function AnswerScreen({
  correct,
  selectedIdx,
  answerIdx,
  options,
  rung,
  bankedThisQuestion,
  questionIdx,
  questionCount,
  eliminated,
  onContinue,
  onExit,
  autoAdvance = false,
  caption,
}: AnswerScreenProps) {
  const { play } = useSound();

  useEffect(() => {
    play(correct ? SoundKey.ROUND_WIN : SoundKey.ERROR);
  }, [correct, play]);

  const tone = correct ? SlideTone.ACTION : SlideTone.CANVAS;
  const headline = correct ? 'Nice — you got it.' : 'Not this time.';
  const label = correct ? 'text-surface' : 'text-ink-3';
  const heading = correct ? 'text-surface' : 'text-ink';

  const optionState = (idx: number): OptionState => {
    if (idx === answerIdx) return OptionState.CORRECT;
    if (!correct && idx === selectedIdx) return OptionState.WRONG;
    return OptionState.HIDDEN;
  };

  return (
    <SlideFrame tone={tone} animateKey={`${questionIdx}-${correct}`}>
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

        {/* Options — correct highlighted, wrong marked */}
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {(options as string[]).map((text, idx) => (
            <OptionButton
              key={idx}
              index={idx as 0 | 1 | 2 | 3}
              text={text}
              state={optionState(idx)}
            />
          ))}
        </div>

        {/* Rung value banked (or 0) */}
        <div className="flex flex-col items-center gap-1">
          <span className={`font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] ${label}`}>
            {correct ? 'Banked' : 'Worth'}
          </span>
          <span className={`font-serif text-[52px] font-semibold leading-none tabular-nums ${correct ? 'text-surface' : 'text-ink'}`}>
            {correct ? formatRung(bankedThisQuestion) : formatRung(rung)}
          </span>
        </div>

        <span className={`font-sans text-[14px] font-semibold ${label}`}>
          Question {questionIdx + 1} of {questionCount}
        </span>

        {/* Actions — hidden in MP (engine times the reveal → next) */}
        {autoAdvance ? (
          caption !== undefined ? (
            <span className={`font-sans text-[13px] font-semibold ${label}`}>{caption}</span>
          ) : null
        ) : (
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {!eliminated ? (
              <Button variant={correct ? 'secondary' : 'primary'} size="lg" className="w-full sm:w-auto" onClick={onContinue}>
                Continue playing
              </Button>
            ) : null}
            <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onExit}>
              {eliminated ? 'See final score' : 'Exit'}
            </Button>
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
