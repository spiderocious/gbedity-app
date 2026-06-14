import { Card } from '@gbedity/ui';
import { Hash, Sparkles, Timer } from '@icons';

import { LetterBadge } from '../ui/letter-badge.tsx';
import { CategoryPill } from '../ui/category-pill.tsx';
import { WordInput } from '../ui/word-input.tsx';
import { RoundClock } from '../ui/round-clock.tsx';
import { MetaStrip } from '../ui/meta-strip.tsx';
import { SlideFrame, SlideTone } from '../ui/slide-frame.tsx';

// QUESTION — the play screen. Green slide, compact. The letter + category are the prompt; the player
// types a word that starts with the letter and fits the category. Pure UI: every value is a prop.

interface QuestionScreenProps {
  readonly letter: string;
  readonly category: string;
  readonly roundIndex: number;
  readonly rounds: number;
  readonly secondsLeft: number;
  readonly secondsPerRound: number;
  readonly pointsOnOffer: number;
  readonly guess: string;
  readonly onGuessChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly locked: boolean;
  // MP additive: spectator sees the prompt but no input.
  readonly readOnly?: boolean;
}

export function QuestionScreen({
  letter,
  category,
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
}: QuestionScreenProps) {
  const progress = secondsPerRound > 0 ? secondsLeft / secondsPerRound : 0;

  return (
    <SlideFrame tone={SlideTone.ACTION} compact animateKey={roundIndex}>
      <div className="flex w-full max-w-2xl flex-col items-center gap-5">
        {/* Title + round */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/90">
            Wordshot
          </span>
          <span className="font-serif text-[22px] font-semibold text-surface">
            Round {roundIndex + 1} of {rounds}
          </span>
        </div>

        {/* Prompt card — letter badge + category pill on white */}
        <Card size="lg" className="w-full">
          <div className="mb-3 text-center">
            <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
              Name something in this category
            </span>
          </div>
          <div className="flex flex-col items-center gap-4 py-4">
            <LetterBadge letter={letter} animateKey={roundIndex} />
            <CategoryPill category={category} tone="on-light" />
          </div>
        </Card>

        {/* Timer + input */}
        <Card size="lg" className="flex w-full flex-col gap-4">
          <RoundClock progress={progress} secondsLeft={secondsLeft} />
          {readOnly ? (
            <p className="text-center font-sans text-[14px] text-ink-3">Players are racing…</p>
          ) : (
            <WordInput value={guess} onChange={onGuessChange} onSubmit={onSubmit} letter={letter} locked={locked} />
          )}
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
