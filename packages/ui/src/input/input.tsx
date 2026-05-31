import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

// Visual spec: design-system/projects/gbedity/preview/11-inputs.html
//
// Two-pixel borders, 16px radius, generous padding. Nunito 17px so a phone
// keyboard's tap feels confident. Focus is action green; error is tomato red.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, type, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type ?? 'text'}
      className={cn(
        'block w-full rounded-input border-2 bg-surface px-4 py-[14px]',
        'font-sans text-[17px] font-medium text-ink',
        'placeholder:font-normal placeholder:text-ink-4',
        'transition-colors duration-150 ease-in-out',
        'focus:outline-none',
        error === true
          ? 'border-danger focus:border-danger'
          : 'border-mist-soft focus:border-action',
        'disabled:cursor-not-allowed disabled:bg-mist-soft disabled:text-ink-3',
        className,
      )}
      {...rest}
    />
  );
});

export interface FieldProps {
  label: string;
  helper?: ReactNode;
  error?: string;
  success?: string;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Field — label + control + helper/error/success.
 *
 * Visual spec: design-system/projects/gbedity/preview/11-inputs.html
 *
 * The label is Nunito 700 13px. Helper text is 12px ink-3. Error replaces
 * helper with danger-deep; success replaces it with action-deep.
 */
export function Field({ label, helper, error, success, htmlFor, children }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const message = error ?? success;
  const tone =
    error !== undefined && error !== ''
      ? 'text-danger-deep'
      : success !== undefined && success !== ''
        ? 'text-action-deep'
        : 'text-ink-3';

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="mb-2 font-sans text-[13px] font-bold text-ink"
      >
        {label}
      </label>
      {children}
      {(message !== undefined && message !== '') || helper !== undefined ? (
        <p className={cn('mt-[6px] text-[12px] leading-[1.5]', tone)}>
          {message !== undefined && message !== '' ? message : helper}
        </p>
      ) : null}
    </div>
  );
}

// The Studio shows GBE-4ZK as the canonical example — 6 chars, dash-separated visually
// but stored uppercase without the dash. Caller controls value/onChange.
export type RoomCodeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>;

/**
 * RoomCodeInput — the six-character joiner.
 *
 * Visual spec: design-system/projects/gbedity/preview/11-inputs.html
 *
 * Tabular-spaced uppercase. Wide tracking. Centred. This is the first input
 * a brand-new player touches; it earns the bigger type.
 */
export const RoomCodeInput = forwardRef<HTMLInputElement, RoomCodeInputProps>(
  function RoomCodeInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={7}
        className={cn(
          'block w-full max-w-[320px] rounded-input border-2 border-ink-5 bg-surface',
          'px-[22px] py-[18px]',
          'text-center font-sans text-[28px] font-extrabold uppercase tracking-[0.4em] text-ink',
          'placeholder:font-extrabold placeholder:tracking-[0.4em] placeholder:text-ink-4',
          'transition-colors duration-150 ease-in-out',
          'focus:border-action focus:outline-none',
          className,
        )}
        {...rest}
      />
    );
  },
);
