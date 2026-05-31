import type { ReactNode } from 'react';

import { Pill, Score } from '@gbedity/ui';

// Reusable in-game content building blocks shared across game content renderers, so each
// game's renderDisplay/renderPlayer stays a small composition. Presentational only.

interface McqOption {
  readonly letter: string;
  readonly text: string;
  /** 'correct' pulses green, 'wrong' fades — used in reveal states. */
  readonly state?: 'idle' | 'correct' | 'wrong';
}

export function McqOptions({ options }: { readonly options: readonly McqOption[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const tone =
          o.state === 'correct'
            ? 'border-action bg-action-soft'
            : o.state === 'wrong'
              ? 'border-ink-5 opacity-40'
              : 'border-ink-5';
        return (
          <div
            key={o.letter}
            className={`flex items-center gap-3 rounded-card border-2 bg-surface px-4 py-3 ${tone}`}
          >
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-canvas font-sans text-[14px] font-extrabold text-ink">
              {o.letter}
            </span>
            <span className="font-sans text-[15px] font-semibold text-ink">{o.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Filled/empty dots showing how many players have checked in. */
export function CheckinDots({ total, filled }: { readonly total: number; readonly filled: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${filled} of ${total} answered`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-[10px] w-[10px] rounded-full ${i < filled ? 'bg-action' : 'bg-ink-5'}`}
        />
      ))}
    </div>
  );
}

/** A live feed of answer pills sliding in (Wordshot / Synonyms). */
export function SubmissionFeed({ items }: { readonly items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex items-center rounded-full bg-action-soft px-3 py-[6px] font-sans text-[13px] font-bold text-action-deep"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/** Live-ranked closest-guess rows (Scrambled Word / Definition Race). */
export function RankedGuesses({
  guesses,
}: {
  readonly guesses: readonly { readonly name: string; readonly pct: number }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {guesses.map((g, i) => (
        <div
          key={`${g.name}-${i}`}
          className="flex items-center justify-between rounded-[12px] bg-canvas px-4 py-[10px]"
        >
          <span className="font-sans text-[14px] font-bold text-ink">{g.name}</span>
          <span className="font-serif text-[16px] font-semibold tabular-nums text-ink-2">
            {g.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimerPill({ value }: { readonly value: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-canvas px-4 py-[6px] font-sans text-[16px] font-bold tabular-nums text-ink">
      {value}
    </span>
  );
}

export function CategoryBadge({ children }: { readonly children: ReactNode }) {
  return <Pill tone="accent">{children}</Pill>;
}

/** A labelled vote-tally bar (Truth or Dare / Catch the Lie / Hot Take). */
export function VoteBars({
  rows,
}: {
  readonly rows: readonly { readonly label: string; readonly pct: number; readonly accent?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="mb-1 flex justify-between font-sans text-[13px] font-bold text-ink">
            <span className="truncate pr-3">{r.label}</span>
            <span className="tabular-nums text-ink-3">{r.pct}%</span>
          </div>
          <div className="h-[8px] overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full ${r.accent === true ? 'bg-accent' : 'bg-action'}`}
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Player text-input mock for in-game player views. Decorative (no real submit). */
export function PlayerInputMock({
  placeholder,
  cta = 'Submit',
  helper,
}: {
  readonly placeholder: string;
  readonly cta?: string;
  readonly helper?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder={placeholder}
        className="block w-full rounded-input border-2 border-mist-soft bg-surface px-4 py-[14px] font-sans text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-ink-4 focus:border-action focus:outline-none"
      />
      {helper !== undefined ? (
        <p className="font-sans text-[12px] text-ink-3">{helper}</p>
      ) : null}
      <button
        type="button"
        className="inline-flex h-12 items-center justify-center rounded-btn bg-action px-7 font-sans text-[16px] font-bold text-white hover:bg-action-deep"
      >
        {cta}
      </button>
    </div>
  );
}

/** A big hero number for display moments (Word Bomb bomb, timers). */
export function HeroNumeral({
  value,
  tone = 'ink',
  unit,
}: {
  readonly value: ReactNode;
  readonly tone?: 'ink' | 'danger' | 'accent' | 'action';
  readonly unit?: ReactNode;
}) {
  return <Score value={value} size="hero" tone={tone} unit={unit} />;
}
