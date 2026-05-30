import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../utils/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "gb-button--primary",
  secondary: "gb-button--secondary",
  ghost: "gb-button--ghost",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gb-button--sm",
  md: "gb-button--md",
  lg: "gb-button--lg",
};

/**
 * Button — the shared Gbedity button primitive.
 *
 * Styling is class-based (see `styles.css`) so consumers can theme it without a CSS
 * framework. A template placeholder; extend variants/sizes as the game's UI grows.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
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
          "gb-button",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...rest}
      >
        {leadingIcon ? (
          <span className="gb-button__icon">{leadingIcon}</span>
        ) : null}
        <span>{loading ? "Loading…" : children}</span>
        {trailingIcon ? (
          <span className="gb-button__icon">{trailingIcon}</span>
        ) : null}
      </button>
    );
  },
);
