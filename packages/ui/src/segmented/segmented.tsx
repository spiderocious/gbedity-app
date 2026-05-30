import { cn } from '../utils/cn.ts';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional accessible label for the group. */
  ariaLabel?: string;
  /** Render small variant (used in dense config rows). */
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

// Visual spec: design-system/projects/gbedity/preview/12-selection.html
//                design-system/projects/gbedity/preview/_foundation.css (.seg block)
//
// The 2–3 mutually exclusive option pill. Canvas-mint track, white-surface
// thumb on the active option. Used everywhere in config screens — bomb time,
// rounds, difficulty, charge severity.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'sm',
  className,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled === true ? true : undefined}
      className={cn(
        'inline-flex rounded-full bg-canvas p-[2px]',
        disabled === true && 'opacity-40',
        className,
      )}
    >
      {options.map((opt) => {
        const isOn = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isOn}
            disabled={disabled === true}
            onClick={() => onChange(opt.value)}
            className={cn(
              'cursor-pointer rounded-full border-0 bg-transparent font-sans font-bold',
              'transition-colors duration-150 ease-in-out',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              'disabled:cursor-not-allowed',
              size === 'sm' ? 'px-3 py-[6px] text-[12px]' : 'px-4 py-2 text-[13px]',
              isOn
                ? 'bg-surface text-ink'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
