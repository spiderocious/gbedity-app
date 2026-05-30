import { cn } from '../utils/cn.ts';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/12-selection.html
//
// Binary on/off. Pill body, circular thumb. Canvas-mint off; action-green on.
// Used in config screens for boolean toggles — autocorrect, audience-favourite
// bonus, allow-heckle-questions, anonymous voting.
export function Switch({ checked, onChange, ariaLabel, disabled, className }: SwitchProps) {
  function handleClick() {
    if (disabled === true) return;
    onChange(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={disabled === true}
      className={cn(
        'relative inline-flex h-[26px] w-[44px] flex-shrink-0 cursor-pointer items-center rounded-full border-0 p-0',
        'transition-colors duration-150 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-action' : 'bg-canvas',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-surface shadow-[0_1px_3px_rgba(31,107,74,0.15)]',
          'transition-transform duration-150 ease-in-out',
          checked ? 'translate-x-[21px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}
