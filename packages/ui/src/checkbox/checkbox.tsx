import { useId, type ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

// Visual spec: design-system/projects/gbedity/preview/12-selection.html
//
// Square 22×22, 7px radius, 2px ink border. Action-green fill when on with a
// white checkmark glyph. Used inside multi-select lists in game configs.
export function Checkbox({ checked, onChange, label, disabled, className, id }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  function handleClick() {
    if (disabled === true) return;
    onChange(!checked);
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex cursor-pointer items-center gap-[10px] font-sans text-[14px] font-semibold text-ink',
        disabled === true && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <button
        id={inputId}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled === true}
        onClick={handleClick}
        className={cn(
          'flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] border-2 bg-surface p-0',
          'transition-colors duration-150 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          'disabled:cursor-not-allowed',
          checked ? 'border-action bg-action' : 'border-ink',
        )}
      >
        {checked ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-[12px] w-[12px] text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 8 7 12 13 4" />
          </svg>
        ) : null}
      </button>
      {label !== undefined && label !== null ? <span>{label}</span> : null}
    </label>
  );
}
