import { Card } from '@gbedity/ui';
import { Hash, Sparkles, Timer } from '@icons';

import { LetterSlots, SlotTone } from '../ui/letter-slots.tsx';
import { GuessInput } from '../ui/guess-input.tsx';
import { RoundClock } from '../ui/round-clock.tsx';
import { MetaStrip } from '../ui/meta-strip.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';

// QUESTION — the play screen, built as a centred green SLIDE (same tone as intro + scores) so the
// whole game reads as one deck. White cards pop against the green (the Hot-Seat look). Inside: a
// title, the masked word as letter tiles, the timer + guess input, then a facts strip — all centred.
// Pure UI: every value is a prop.

interface QuestionScreenProps {
  readonly masked: string;
  readonly length: number;
  readonly roundIndex: number; // 0-based
  readonly rounds: number;
  readonly secondsLeft: number;
  readonly secondsPerRound: number;
  readonly pointsOnOffer: number;
  readonly guess: string;
  readonly onGuessChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly locked: boolean;
  /** Spectator/display surface: read-only, no input ("Players are racing…"). */
  readonly readOnly?: boolean;
  /** Multiplayer presence under the timer (e.g. "3 of 5 locked in"). */
  readonly presence?: string;
}

export function QuestionScreen({
  masked,
  length,
  roundIndex,
  rounds,
  secondsLeft,
  secondsPerRound,
  pointsOnOffer,
  guess,
  onGuessChange,
  onSubmit,
  locked,
  readOnly = false,
  presence,
}: QuestionScreenProps) {
  const progress = secondsPerRound > 0 ? secondsLeft / secondsPerRound : 0;

  return (
    <SlideFrame tone={SlideTone.ACTION} compact animateKey={roundIndex}>
      <div className="flex w-full max-w-2xl flex-col items-center gap-5">
        {/* Title + round, in white on the green slide */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
            Missing Letters
          </span>
          <span className="font-serif text-[22px] font-semibold text-surface">
            Round {roundIndex + 1} of {rounds}
          </span>
        </div>

        {/* The word card — white on green */}
        <Card size="lg" className="w-full">
          <div className="mb-4 text-center">
            <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
              Fill the blanks
            </span>
          </div>
          <div className="flex flex-col items-center gap-6 py-4">
            <LetterSlots masked={masked} tone={SlotTone.ON_LIGHT} size="lg" animateKey={roundIndex} />
          </div>
        </Card>

        {/* Timer + input (or a read-only spectator beat) */}
        <Card size="lg" className="flex w-full flex-col gap-4">
          <RoundClock progress={progress} secondsLeft={secondsLeft} />
          {readOnly ? (
            <div className="flex w-full items-center justify-center rounded-[16px] bg-canvas px-5 py-4 font-sans text-[15px] font-bold text-ink-3">
              Players are racing…
            </div>
          ) : (
            <GuessInput value={guess} onChange={onGuessChange} onSubmit={onSubmit} length={length} locked={locked} />
          )}
          {presence !== undefined ? (
            <p className="text-center font-sans text-[13px] font-semibold text-ink-3">{presence}</p>
          ) : null}
        </Card>

        {/* Facts strip */}
        <MetaStrip
          className="w-full"
          facts={[
            { icon: <Timer size={16} aria-hidden="true" />, label: 'Time', value: `${secondsPerRound}s` },
            { icon: <Hash size={16} aria-hidden="true" />, label: 'Round', value: `${roundIndex + 1} / ${rounds}` },
            { icon: <Sparkles size={16} aria-hidden="true" />, label: 'Up for grabs', value: `${pointsOnOffer} pts` },
          ]}
        />
      </div>
    </SlideFrame>
  );
}
