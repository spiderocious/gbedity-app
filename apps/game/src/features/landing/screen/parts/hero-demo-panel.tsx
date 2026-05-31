import { useEffect, useState } from 'react';

import { Score } from '@gbedity/ui';

import {
  HERO_MOMENTS,
  MomentKind,
  type HeroMoment,
} from '../../shared/hero-moments.ts';

// The hero's "what does this look like" answer — a looping montage of mock in-game
// moments. Pure presentation: static frames, crossfaded on a timer. No game logic.
// Honors reduced-motion (holds one frame, no cycling).

const HOLD_MS = 3000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function HeroDemoPanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion() || HERO_MOMENTS.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_MOMENTS.length);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, []);

  const moment = HERO_MOMENTS[index] ?? HERO_MOMENTS[0];
  if (moment === undefined) return null;

  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-card-lg bg-stage p-2 shadow-lift-modal">
      <div className="relative h-[260px] overflow-hidden rounded-card bg-surface">
        {HERO_MOMENTS.map((m, i) => (
          <div
            key={m.kind}
            aria-hidden={i === index ? undefined : true}
            className="absolute inset-0 flex flex-col p-6 transition-opacity duration-[250ms] ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            <MomentFrame moment={m} />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-[6px] pt-2">
        {HERO_MOMENTS.map((m, i) => (
          <span
            key={m.kind}
            aria-hidden="true"
            className="h-[5px] rounded-full bg-white transition-all duration-[250ms]"
            style={{ width: i === index ? 18 : 5, opacity: i === index ? 1 : 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

interface MomentFrameProps {
  readonly moment: HeroMoment;
}

function MomentFrame({ moment }: MomentFrameProps) {
  return (
    <>
      <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
        {moment.label}
      </span>
      <div className="mt-3 flex flex-1 flex-col justify-center">
        <MomentBody moment={moment} />
      </div>
    </>
  );
}

function MomentBody({ moment }: MomentFrameProps) {
  switch (moment.kind) {
    case MomentKind.WORD_BOMB:
      return (
        <div className="text-center">
          <Score value={moment.seconds} size="hero" tone="danger" unit="s" />
          <p className="mt-1 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3">
            {moment.promptCategory}
          </p>
          <p className="mt-2 font-sans text-[14px] text-ink-2">{moment.prompt}</p>
        </div>
      );
    case MomentKind.WORDSHOT:
      return (
        <div className="text-center">
          <Score value={moment.letter} size="hero" tone="action" />
          <p className="mt-2 font-sans text-[15px] font-bold text-ink">{moment.prompt}</p>
        </div>
      );
    case MomentKind.HOT_TAKE:
      return (
        <div>
          <p className="font-serif text-[22px] font-semibold leading-[1.15] text-ink">
            “{moment.prompt}”
          </p>
          <div className="mt-4 flex items-center justify-between rounded-[14px] bg-accent-soft px-4 py-3">
            <span className="font-sans text-[13px] font-bold text-ink">{moment.winner}</span>
            <Score value={moment.votes} size="sm" tone="accent" unit="votes" />
          </div>
        </div>
      );
    case MomentKind.CATCH_THE_LIE:
      return (
        <div className="flex flex-col gap-2">
          {moment.statements.map((s, i) => (
            <div
              key={s}
              className="rounded-[12px] bg-canvas px-3 py-[10px] font-sans text-[13px] font-semibold text-ink"
            >
              <span className="mr-2 font-extrabold text-ink-3">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      );
    case MomentKind.PLEAD_VERDICT:
      return (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Verdict
            </span>
            <Score value={moment.score} size="md" tone="action" unit="/100" />
          </div>
          <div className="mt-3 flex flex-col gap-[10px]">
            {moment.criteria.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between font-sans text-[12px] font-bold text-ink-3">
                  <span>{c.label}</span>
                  <span className="tabular-nums">{c.value}</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-action"
                    style={{ width: `${c.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
