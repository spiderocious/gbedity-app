import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

// Variant/size styles are Tailwind utilities referencing the shared theme tokens
// (see tailwind.preset.ts). Consuming apps compile these classes because their
// content globs include `packages/ui/src/**`.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand border-brand text-brand-fg hover:bg-brand-hover hover:border-brand-hover',
  secondary: 'bg-transparent border-ink text-ink hover:bg-ink hover:text-white',
  ghost: 'bg-transparent border-transparent text-ink-secondary hover:bg-ink/5 hover:text-ink',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-[18px] text-base gap-2',
};

/**
 * Button — the shared Gbedity button primitive.
 *
 * Styled with Tailwind utilities. A template placeholder; extend variants/sizes as the
 * game's UI grows.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    loading,
    leadingIcon,
    trailingIcon,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded border font-sans font-medium',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-45',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {leadingIcon ? <span className="-ml-0.5 inline-flex">{leadingIcon}</span> : null}
      <span>{loading ? 'Loading…' : children}</span>
      {trailingIcon ? <span className="-mr-0.5 inline-flex">{trailingIcon}</span> : null}
    </button>
  );
});
