import { cn } from '@gbedity/ui';

// A single MCQ option button for the question screen. Four of these appear in a 2×2 grid.
// States: default (green outline on green), hidden (50/50 removed), correct (reveal),
// wrong (reveal). Props-only — caller drives the state.

const OptionLabel = ['A', 'B', 'C', 'D'] as const;

export const OptionState = {
  DEFAULT: 'default',
  HIDDEN: 'hidden',
  SELECTED: 'selected',
  CORRECT: 'correct',
  WRONG: 'wrong',
} as const;
export type OptionState = (typeof OptionState)[keyof typeof OptionState];

interface OptionButtonProps {
  readonly index: 0 | 1 | 2 | 3;
  readonly text: string;
  readonly state: OptionState;
  readonly onClick?: () => void;
}

export function OptionButton({ index, text, state, onClick }: OptionButtonProps) {
  const label = OptionLabel[index];
  const isHidden = state === OptionState.HIDDEN;
  const isCorrect = state === OptionState.CORRECT;
  const isWrong = state === OptionState.WRONG;
  const isSelected = state === OptionState.SELECTED;
  const isInteractive = state === OptionState.DEFAULT && onClick !== null && onClick !== undefined;

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive || isHidden}
      aria-hidden={isHidden}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-sans text-[15px] font-semibold transition-all duration-150',
        // Default — white card, clickable
        state === OptionState.DEFAULT &&
          'border-surface/30 bg-surface text-ink hover:border-action hover:bg-action/5 active:scale-[0.98]',
        // Selected before reveal
        isSelected && 'border-action bg-action/10 text-ink',
        // Correct reveal
        isCorrect && 'border-transparent bg-[#27B973] text-surface shadow-[0_4px_16px_rgba(39,185,115,0.4)]',
        // Wrong reveal
        isWrong && 'border-transparent bg-danger text-surface opacity-80',
        // Hidden by 50/50
        isHidden && 'pointer-events-none border-transparent bg-surface/10 text-surface/20',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold',
          state === OptionState.DEFAULT && 'bg-canvas text-ink-3',
          isSelected && 'bg-action text-surface',
          isCorrect && 'bg-surface/30 text-surface',
          isWrong && 'bg-surface/20 text-surface',
          isHidden && 'bg-surface/10 text-surface/20',
        )}
      >
        {label}
      </span>
      <span className={cn(isHidden && 'invisible')}>{text}</span>
    </button>
  );
}
