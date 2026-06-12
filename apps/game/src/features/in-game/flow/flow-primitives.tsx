import { useEffect, useRef, useState, type ReactNode } from 'react';

import { GameAvatar, OrangeWinnerBar, Score, type SeatIndex } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Repeat, Show } from 'meemaw';

// Reusable, game-agnostic flow primitives for the animated in-game flow (spec: missing-letters-flow
// §3.5). GSAP (already an app dep) + reduced-motion gated throughout. Not in @gbedity/ui — these are
// in-game-specific until a 2nd game reuses them.

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── StageTransition ───────────────────────────────────────────────────────────
// Cross-fade + slight scale between flow stages. Keyed by `stageKey` so a stage change replays the
// entrance. Reduced-motion → instant (no transform/opacity animation).
export function StageTransition({ stageKey, children }: { readonly stageKey: string; readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (prefersReducedMotion() || !el) return;
      // At game start the stage can churn fast (intro → countdown → round_start → playing in ~1s).
      // Kill any in-flight entrance and clear ALL props (incl. opacity) when done — otherwise an
      // interrupted tween can strand the wrapper at opacity < 1 (the "host stuck on GO!" round-1 bug).
      gsap.killTweensOf(el);
      gsap.fromTo(
        el,
        { opacity: 0, y: 12, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'opacity,transform' },
      );
    },
    { dependencies: [stageKey] },
  );
  return (
    <div ref={ref} className="w-full">
      {children}
    </div>
  );
}

// ── CountdownNumerals ───────────────────────────────────────────────────────────
// Big "3 · 2 · 1 · GO" beat. `value` is the current tick (0 → "GO"). Each value springs in.
export function CountdownNumerals({ value }: { readonly value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)', clearProps: 'transform' },
      );
    },
    { dependencies: [value] },
  );
  const label = value <= 0 ? 'GO' : String(value);
  const tone = value <= 0 ? 'action' : value === 1 ? 'danger' : value === 2 ? 'warn' : 'accent';
  return (
    <div ref={ref} className="flex items-center justify-center" aria-live="assertive">
      <Score value={label} size="hero" tone={tone} />
    </div>
  );
}

// ── CountdownRing ───────────────────────────────────────────────────────────────
// An SVG ring that drains from full → empty over [now, deadline], with the LIVE seconds-remaining
// number centered inside. The ring drains via a CSS transition (no per-frame JS); the number ticks
// once a second. Reduced-motion: static ring + the number. Both derive from the backend `deadline`,
// so the visible timer always matches the server clock.
export function CountdownRing({
  deadline,
  totalMs,
  size = 64,
}: {
  readonly deadline: number;
  readonly totalMs: number;
  readonly size?: number;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

  // Tick the seconds number every 250ms (snappy without per-frame cost), recomputed from deadline.
  useEffect(() => {
    const tick = (): void => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  // Drain the ring.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const remaining = Math.max(0, deadline - Date.now());
    const startFrac = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0;
    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = String(circ * (1 - startFrac));
      return undefined;
    }
    el.style.transition = 'none';
    el.style.strokeDashoffset = String(circ * (1 - startFrac));
    void el.getBoundingClientRect(); // force reflow so the next transition takes effect
    el.style.transition = `stroke-dashoffset ${remaining}ms linear`;
    el.style.strokeDashoffset = String(circ);
    return undefined;
  }, [deadline, totalMs, circ]);

  // tone shifts as time runs low (brand: forest → warn → danger) — colour is never the only signal
  // (the number is right there), but it adds urgency.
  const tone = secondsLeft <= 3 ? 'text-danger' : secondsLeft <= 6 ? 'text-warn-deep' : 'text-action';

  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-canvas-deep" />
        <circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          className={tone}
        />
      </svg>
      <span
        role="timer"
        aria-label={`${secondsLeft} seconds left`}
        className={`absolute font-serif font-semibold tabular-nums ${tone}`}
        style={{ fontSize: Math.round(size * 0.36) }}
      >
        {secondsLeft}
      </span>
    </span>
  );
}

// ── GoTransition ──────────────────────────────────────────────────────────────────
// The between-rounds "GO!" takeover (Screen 4). Full-viewport, no card/chrome — it owns the ~1.5s
// it's on screen. A round eyebrow drops in, the headline scales up with elastic ease, a confetti
// burst fires outward in 360°, and a Stage-Cobalt ring expands from the centre. Reduced-motion: a
// simple opacity fade of the headline, no confetti/ring/scale physics.
const GO_CONFETTI = ['#27B973', '#FF8A2A', '#7B4FBF', '#F7C948', '#5BC0EB'] as const;

export function GoTransition({ eyebrow, headline }: { readonly eyebrow: string; readonly headline: string }) {
  const root = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const headlineEl = headlineRef.current;
      const eyebrowEl = eyebrowRef.current;
      if (!headlineEl) return;

      if (prefersReducedMotion()) {
        gsap.fromTo([eyebrowEl, headlineEl], { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.05 });
        return;
      }

      const tl = gsap.timeline();
      tl.fromTo(eyebrowEl, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
      tl.fromTo(
        headlineEl,
        { scale: 0.3, opacity: 0 },
        { scale: 1.15, opacity: 1, duration: 0.35, ease: 'elastic.out(1, 0.6)' },
        '-=0.1',
      );
      tl.to(headlineEl, { scale: 1, duration: 0.15, ease: 'power2.out' });

      // Cobalt ring expands outward from centre as the headline settles.
      if (ringRef.current) {
        tl.fromTo(
          ringRef.current,
          { scale: 0, opacity: 1 },
          { scale: 1, opacity: 0, duration: 0.6, ease: 'power2.out' },
          '-=0.3',
        );
      }

      // Confetti burst — 12 particles outward in 360° with physics-y fall.
      const layer = root.current?.querySelector('[data-go-confetti]');
      if (layer) {
        for (let i = 0; i < 12; i += 1) {
          const dot = document.createElement('span');
          dot.className = 'absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full';
          dot.style.backgroundColor = GO_CONFETTI[i % GO_CONFETTI.length] ?? '#27B973';
          layer.appendChild(dot);
          const angle = (i / 12) * Math.PI * 2;
          const dist = 160 + (i % 3) * 40;
          gsap.fromTo(
            dot,
            { x: 0, y: 0, opacity: 1, scale: 1 },
            {
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist + 80,
              opacity: 0,
              scale: 0.6,
              rotate: 240,
              duration: 1,
              ease: 'power1.out',
              delay: 0.35,
              onComplete: () => dot.remove(),
            },
          );
        }
      }
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center" aria-live="assertive">
      <span ref={eyebrowRef} className="font-sans text-[14px] font-extrabold uppercase tracking-[0.16em] text-stage">
        {eyebrow}
      </span>
      <div className="relative flex items-center justify-center">
        <span
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute h-[200px] w-[200px] rounded-full border-4 border-stage"
        />
        <h2 className="font-serif text-[clamp(96px,28vw,240px)] font-bold leading-none tracking-[-0.03em] text-ink">
          {headline}
        </h2>
      </div>
      <div data-go-confetti className="pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}

// ── TimerBar ────────────────────────────────────────────────────────────────────
// A full-width horizontal bar that drains left→right over [now, deadline] — the urgency device for
// speed rounds. Colour steps Action Green (>50%) → Sun Yellow (20–50%) → Tomato Red (<20%), and the
// bar pulses (yellow) then pulses faster + shakes (red). The live "0:14 left" label sits above it.
// Like CountdownRing, everything derives from the backend `deadline`, so it matches the server clock.
// Reduced-motion: a static-width bar at the current fraction, the label still ticks, no pulse/shake.
const TIMER_GREEN = '#27B973';
const TIMER_YELLOW = '#F7C948';
const TIMER_RED = '#E85A4F';

export function TimerBar({ deadline, totalMs }: { readonly deadline: number; readonly totalMs: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

  // Tick the label + drive the colour/pulse zone every 100ms (spec: updates every 100ms).
  useEffect(() => {
    const tick = (): void => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [deadline]);

  const frac = totalMs > 0 ? Math.max(0, Math.min(1, (secondsLeft * 1000) / totalMs)) : 0;
  const zone = frac < 0.2 ? 'red' : frac < 0.5 ? 'yellow' : 'green';
  const color = zone === 'red' ? TIMER_RED : zone === 'yellow' ? TIMER_YELLOW : TIMER_GREEN;

  // Drain the fill width over the remaining time (single CSS transition, no per-frame JS).
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return undefined;
    const remaining = Math.max(0, deadline - Date.now());
    const startFrac = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0;
    if (prefersReducedMotion()) {
      el.style.transition = 'none';
      el.style.width = `${startFrac * 100}%`;
      return undefined;
    }
    el.style.transition = 'none';
    el.style.width = `${startFrac * 100}%`;
    void el.getBoundingClientRect(); // force reflow so the next transition takes effect
    el.style.transition = `width ${remaining}ms linear`;
    el.style.width = '0%';
    return undefined;
  }, [deadline, totalMs]);

  // Urgency motion on the track: yellow → gentle pulse; red → faster pulse + 1px shake.
  useGSAP(
    () => {
      const el = trackRef.current;
      if (!el || prefersReducedMotion()) return;
      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 1, x: 0 });
      if (zone === 'yellow') {
        gsap.to(el, { opacity: 0.7, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      } else if (zone === 'red') {
        gsap.to(el, { opacity: 0.7, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        gsap.to(el, { x: 1, duration: 0.1, ease: 'none', yoyo: true, repeat: -1, repeatDelay: 0.1 });
      }
    },
    { dependencies: [zone] },
  );

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const label = `${mins}:${secs.toString().padStart(2, '0')} left`;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span
        role="timer"
        aria-label={`${secondsLeft} seconds left`}
        className="font-sans text-[12px] font-bold tabular-nums"
        style={{ color }}
      >
        {label}
      </span>
      <div ref={trackRef} className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-deep" aria-hidden="true">
        <div ref={fillRef} className="h-full rounded-full" style={{ width: '100%', backgroundColor: color, transition: 'background-color 400ms linear' }} />
      </div>
    </div>
  );
}

// ── LetterSlots ───────────────────────────────────────────────────────────────
// Renders a word as per-letter tiles. `revealed` (the answer) shows real letters; otherwise the
// masked string ("B _ N _ N _") is shown. On reveal, blanks flip to letters with a stagger.
export function LetterSlots({
  masked,
  answer,
  size = 'md',
  cascade = false,
}: {
  readonly masked: string;
  readonly answer?: string;
  readonly size?: 'md' | 'lg' | 'xl';
  /** Cascade the tiles in left→right on first appearance of this word (the playing-stage entrance). */
  readonly cascade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // masked is space-separated ("B _ N _ N _"); split to chars.
  const chars = masked.split(' ').filter((c) => c.length > 0);
  const answerChars = answer ? answer.toUpperCase().split('') : null;
  const dim = size === 'xl' ? 'h-[88px] w-[68px] text-[44px]' : size === 'lg' ? 'h-16 w-12 text-[34px]' : 'h-12 w-9 text-[24px]';

  // Reveal flip — blanks rotate in to letters when the answer lands.
  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current || !answerChars) return;
      gsap.fromTo(
        ref.current.querySelectorAll('[data-revealed="true"]'),
        { rotateX: -90, opacity: 0 },
        { rotateX: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.5)', stagger: 0.07, clearProps: 'transform' },
      );
    },
    { dependencies: [answer] },
  );

  // Entrance cascade — every tile drops in left→right when a new word appears (no answer yet).
  useGSAP(
    () => {
      if (!cascade || prefersReducedMotion() || !ref.current || answerChars) return;
      const tiles = ref.current.querySelectorAll('[data-tile]');
      gsap.killTweensOf(tiles);
      // Clear opacity too — if the round→playing swap interrupts this, tiles must not strand hidden.
      gsap.fromTo(
        tiles,
        { y: -16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.7)', stagger: 0.06, clearProps: 'opacity,transform' },
      );
    },
    { dependencies: [masked, cascade] },
  );

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-center gap-2">
      <Repeat each={chars}>
        {(ch, i) => {
          const revealedChar = answerChars?.[i];
          const shown = revealedChar ?? (ch === '_' ? '' : ch.toUpperCase());
          const isBlank = ch === '_' && revealedChar === undefined;
          return (
            <span
              key={i}
              data-tile
              data-revealed={revealedChar !== undefined && ch === '_' ? 'true' : 'false'}
              className={`inline-flex items-center justify-center rounded-btn-sm font-serif font-semibold ${dim} ${
                isBlank ? 'border-2 border-dashed border-ink-4 text-ink-4' : 'bg-canvas text-ink'
              }`}
            >
              {shown}
            </span>
          );
        }}
      </Repeat>
    </div>
  );
}

// ── RoundScores ───────────────────────────────────────────────────────────────
// The all-players score screen between letter-reveal and the next round (⑤b / Screen 5). A
// celebration-of-progress moment, not a flat leaderboard: a round-highlight banner tells the round's
// story, substantial rows show each player's running total AND their +delta for the round (the delta
// counts up on entry), the leader gets the orange winner-bar treatment, and the rows cascade in.
export interface ScoreRow {
  readonly id?: string;
  readonly name: string;
  readonly points: number;
  readonly roundDelta: number;
}

// Count a number from 0 → target over `ms`, ease-out. Reduced-motion / zero target → snaps instantly.
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target === 0 ? 0 : 0);
  useEffect(() => {
    if (prefersReducedMotion() || target === 0) {
      setValue(target);
      return undefined;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number): void => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

// The single celebration line above the standings — derived from REAL round results, never faked.
function roundHighlight(sorted: readonly ScoreRow[]): { readonly emoji: string; readonly text: string } {
  const topDelta = [...sorted].sort((a, b) => b.roundDelta - a.roundDelta)[0];
  if (topDelta === undefined || topDelta.roundDelta <= 0) {
    return { emoji: '👀', text: 'Tough round. Shake it off.' };
  }
  return { emoji: '🎯', text: `${topDelta.name} led the round — +${topDelta.roundDelta} pts` };
}

function ScoreRowItem({ row, rank, isLeader }: { readonly row: ScoreRow; readonly rank: number; readonly isLeader: boolean }) {
  const delta = useCountUp(row.roundDelta);
  const total = useCountUp(row.points);
  const seat = (((rank - 1) % 8) + 1) as SeatIndex;
  return (
    <div
      data-score-row
      className={`flex items-center gap-3 rounded-card px-3 py-3 ${isLeader ? 'bg-accent text-surface' : 'bg-surface-soft text-ink'}`}
    >
      <span className={`w-6 text-center font-serif text-[26px] font-semibold ${isLeader ? 'text-surface' : 'text-ink-3'}`}>
        {rank}
      </span>
      <GameAvatar id={row.id ?? row.name} initial={row.name.charAt(0).toUpperCase()} seat={seat} size="md" />
      <span className="min-w-0 flex-1 truncate font-serif text-[19px] font-semibold">{row.name}</span>
      <span className="flex items-baseline gap-2">
        {row.roundDelta > 0 ? (
          <span className={`font-sans text-[13px] font-bold ${isLeader ? 'text-surface/85' : 'text-action-deep'}`}>
            +{delta}
          </span>
        ) : null}
        <span className="font-serif text-[24px] font-semibold tabular-nums">{total}</span>
      </span>
    </div>
  );
}

export function RoundScores({ title, rows }: { readonly title: string; readonly rows: readonly ScoreRow[] }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const top = sorted[0];
  // Only crown a round winner when someone actually scored THIS round (roundDelta > 0). If nobody
  // scored, no winner bar — just the standings.
  const hasRoundWinner = top !== undefined && top.roundDelta > 0;
  const highlight = roundHighlight(sorted);

  const listRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      if (bannerRef.current) {
        gsap.fromTo(bannerRef.current, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
      }
      if (listRef.current) {
        // Cascade bottom-up: last place first, the leader lands last.
        const items = gsap.utils.toArray<HTMLElement>('[data-score-row]', listRef.current).reverse();
        gsap.fromTo(items, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.1, clearProps: 'transform' });
      }
    },
    { dependencies: [rows.length] },
  );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <h2 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>

      <div
        ref={bannerRef}
        className="flex w-full items-center gap-3 rounded-card bg-canvas px-4 py-2.5 text-left"
        role="status"
      >
        <span className="text-[20px]" aria-hidden="true">{highlight.emoji}</span>
        <span className="font-serif text-[15px] font-semibold text-ink">{highlight.text}</span>
      </div>

      <Show when={hasRoundWinner}>
        {top !== undefined ? <OrangeWinnerBar name={top.name} score={top.points} label={`Round winner · +${top.roundDelta}`} /> : null}
      </Show>

      <div ref={listRef} className="flex w-full flex-col gap-2">
        <Repeat each={sorted}>
          {(r, i) => <ScoreRowItem key={r.id ?? `${r.name}-${i}`} row={r} rank={i + 1} isLeader={i === 0 && hasRoundWinner} />}
        </Repeat>
      </div>
    </div>
  );
}
