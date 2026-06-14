import { Card } from '@gbedity/ui';
import { Zap } from '@icons';

import { MoneyLadder, formatRung } from '../ui/money-ladder.tsx';
import { OptionButton, OptionState } from '../ui/option-button.tsx';
import { QuestionClock } from '../ui/question-clock.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';

// QUESTION — the live play screen. Layout: green compact slide with a two-column split —
// left: the question card + options grid; right: the money ladder. Fifty-fifty button lives
// above the options. Pure UI: every value is a prop; caller drives all state.

interface QuestionScreenProps {
  readonly prompt: string;
  readonly options: readonly string[];
  readonly hiddenOptions: readonly number[]; // indices hidden by 50/50
  readonly selectedIdx: number | null; // null = nothing selected yet
  readonly questionIdx: number; // 0-based
  readonly questionCount: number;
  readonly secondsLeft: number;
  readonly secondsPerQuestion: number;
  readonly rung: number;
  readonly fiftyFiftyAvailable: boolean;
  readonly onSelect: (idx: number) => void;
  readonly onFiftyFifty: () => void;
  readonly locked: boolean; // true once an answer has been submitted
  readonly readOnly?: boolean; // spectator / non-holder: no input, no lifeline button
}

export function QuestionScreen({
  prompt,
  options,
  hiddenOptions,
  selectedIdx,
  questionIdx,
  questionCount,
  secondsLeft,
  secondsPerQuestion,
  rung,
  fiftyFiftyAvailable,
  onSelect,
  onFiftyFifty,
  locked,
  readOnly = false,
}: QuestionScreenProps) {
  const progress = secondsPerQuestion > 0 ? secondsLeft / secondsPerQuestion : 0;

  const optionState = (idx: number): OptionState => {
    if (hiddenOptions.includes(idx)) return OptionState.HIDDEN;
    if (locked && selectedIdx === idx) return OptionState.SELECTED;
    if (selectedIdx === idx) return OptionState.SELECTED;
    return OptionState.DEFAULT;
  };

  return (
    <SlideFrame tone={SlideTone.ACTION} compact animateKey={questionIdx}>
      <div className="flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left: question + timer + options */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/80">
              Who Wants to Be a Millionaire
            </span>
            <span className="font-serif text-[20px] font-semibold text-surface">
              Question {questionIdx + 1} of {questionCount}
            </span>
          </div>

          {/* Question card */}
          <Card size="lg" className="w-full">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                For {formatRung(rung)}
              </span>
              {!readOnly && (fiftyFiftyAvailable && !locked ? (
                <button
                  type="button"
                  onClick={onFiftyFifty}
                  className="flex items-center gap-1.5 rounded-full bg-action/10 px-3 py-1.5 font-sans text-[12px] font-extrabold text-action transition-colors hover:bg-action/20"
                >
                  <Zap size={13} aria-hidden="true" />
                  50/50
                </button>
              ) : (
                <span className="font-sans text-[12px] font-bold text-ink-4 line-through opacity-50">50/50</span>
              ))}
            </div>

            <p className="py-4 font-sans text-[17px] font-semibold leading-[1.5] text-ink sm:text-[19px]">
              {prompt}
            </p>

            <div className="mt-2">
              <QuestionClock progress={progress} secondsLeft={secondsLeft} />
            </div>
          </Card>

          {/* Options grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(options as string[]).map((text, idx) => (
              <OptionButton
                key={idx}
                index={idx as 0 | 1 | 2 | 3}
                text={text}
                state={optionState(idx)}
                onClick={!readOnly && !locked && !hiddenOptions.includes(idx) ? () => onSelect(idx) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Right: money ladder */}
        <div className="hidden w-40 shrink-0 lg:block">
          <MoneyLadder currentIdx={questionIdx} />
        </div>
      </div>
    </SlideFrame>
  );
}
