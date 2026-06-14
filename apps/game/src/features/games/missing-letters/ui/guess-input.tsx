import { type FormEvent } from 'react';

import { Button, Input } from '@gbedity/ui';
import { ArrowRight } from '@icons';

// The player's guess field: a single text input + submit. Controlled by the caller (value + change),
// submits on Enter or the button. `locked` freezes it after a submission (one shot per round) and
// swaps in a "Locked in" state. Pure presentation — no API, no socket.

interface GuessInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly length?: number;
  readonly locked?: boolean;
  readonly disabled?: boolean;
}

export function GuessInput({ value, onChange, onSubmit, length, locked = false, disabled = false }: GuessInputProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || disabled || value.trim() === '') return;
    onSubmit();
  }

  if (locked) {
    return (
      <div className="flex w-full items-center justify-center rounded-[16px] bg-action-soft px-5 py-4 font-sans text-[16px] font-bold text-action-deep">
        Locked in — sit tight.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={length ? `${length} letters` : 'Type the word'}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        className="flex-1 text-center text-[20px] font-bold tracking-[0.08em]"
      />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={disabled || value.trim() === ''}
        aria-label="Submit guess"
        trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
      >
        Go
      </Button>
    </form>
  );
}
