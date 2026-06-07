import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { formatRoomCode, normalizeRoomCode } from '@gbedity/util';

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

// The Studio shows GBE-4ZK as the canonical example — 6 chars, dash-separated visually but
// stored uppercase without the dash. The component owns the formatting: it shows the dashed
// form and emits the RAW 6-char code via onValueChange, so consumers never re-implement it.
export interface RoomCodeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  /** The raw room code (no dash, uppercase, ≤6 chars). */
  value: string;
  /** Called with the normalized RAW code on every edit/paste. */
  onValueChange: (rawCode: string) => void;
}

/**
 * RoomCodeInput — the six-character joiner.
 *
 * Visual spec: design-system/projects/gbedity/preview/11-inputs.html
 *
 * Self-formatting: auto-inserts the hyphen after the 3rd char while typing, and lands it at
 * the centre whether the user types, pastes a 6-char code, or pastes a 7-char dashed code.
 * `value` is the raw code; `onValueChange` receives the raw code. Tabular-spaced uppercase,
 * wide tracking, centred — the first input a brand-new player touches earns the bigger type.
 */
export const RoomCodeInput = forwardRef<HTMLInputElement, RoomCodeInputProps>(
  function RoomCodeInput({ className, value, onValueChange, ...rest }, ref) {
    // The display always shows the trailing dash at exactly 3 chars ("GBE" → "GBE-"), so it
    // appears on the 3rd keypress. Backspace from "GBE-" then needs to skip past that dash and
    // remove the 3rd char too — otherwise it'd re-render "GBE-" and feel stuck. We detect that
    // exact case (the only change was deleting the trailing dash) and drop one extra char.
    const displayed = formatRoomCode(value, { trailingDash: true });

    function handleChange(next: string) {
      const deletedTrailingDash =
        displayed.endsWith('-') && next === displayed.slice(0, -1);
      const raw = normalizeRoomCode(next);
      onValueChange(deletedTrailingDash ? raw.slice(0, -1) : raw);
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        // 7 = 6 chars + the inserted dash. Normalization caps the raw code regardless.
        maxLength={7}
        value={displayed}
        onChange={(e) => handleChange(e.target.value)}
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
