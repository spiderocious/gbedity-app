import { useEffect, useRef, useState } from 'react';

import { GameAvatar } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Repeat, Show } from 'meemaw';

// The player "waiting for the round to start" moment. The old version was a single sentence in a tiny
// card — it read as a broken loading state. This is a designed beat: a pulsing Stage-Cobalt curtain
// bar, a cycling loading verb, a player check-in row (you're not alone), and a periodic confetti
// burst so the screen is alive without being noisy. All motion is reduced-motion gated.

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const VERBS = ['loading…', 'cueing up…', 'warming up…', 'almost there…'] as const;
const CONFETTI_COLORS = ['#FF8A2A', '#F7C948', '#27B973', '#5BC0EB', '#7B4FBF'] as const;

export interface WaitingPlayer {
  readonly id: string;
  readonly name: string;
}

interface WaitingForRoundProps {
  /** Game name for the hero line ("<name> is loading…"). */
  readonly title: string;
  /** Roster to show in the check-in row. */
  readonly players: readonly WaitingPlayer[];
}

export function WaitingForRound({ title, players }: Readonly<WaitingForRoundProps>) {
  const [verb, setVerb] = useState(0);
  const verbRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Cycle the loading verb every 1.5s with a quick fade between words.
  useEffect(() => {
    const id = window.setInterval(() => setVerb((v) => (v + 1) % VERBS.length), 1500);
    return () => window.clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const root = stageRef.current;
      if (!root || prefersReducedMotion()) return;

      // Curtain bar pulses (opacity 0.6 ↔ 1).
      const bar = root.querySelector('[data-curtain]');
      if (bar) gsap.to(bar, { opacity: 0.6, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      // A small confetti burst every 8s: 3 particles fall from above the curtain.
      const layer = root.querySelector('[data-confetti]');
      const burst = (): void => {
        if (!layer) return;
        for (let i = 0; i < 3; i += 1) {
          const dot = document.createElement('span');
          dot.className = 'absolute h-2 w-2 rounded-full';
          dot.style.backgroundColor = CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#27B973';
          dot.style.left = `${40 + i * 10}%`;
          dot.style.top = '0px';
          layer.appendChild(dot);
          gsap.fromTo(
            dot,
            { y: -8, opacity: 1, rotate: 0 },
            {
              y: 120,
              x: (i - 1) * 24,
              opacity: 0,
              rotate: 180,
              duration: 1.4,
              ease: 'power1.in',
              onComplete: () => dot.remove(),
            },
          );
        }
      };
      const id = window.setInterval(burst, 8000);
      return () => window.clearInterval(id);
    },
    { scope: stageRef },
  );

  // Fade the verb when it changes.
  useGSAP(
    () => {
      if (prefersReducedMotion() || !verbRef.current) return;
      gsap.fromTo(verbRef.current, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power1.out' });
    },
    { dependencies: [verb] },
  );

  const shown = players.slice(0, 5);

  return (
    <div ref={stageRef} className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      {/* Stage-cobalt curtain bar + confetti layer above it. */}
      <div className="relative flex w-full flex-col items-center">
        <div data-confetti className="pointer-events-none absolute -top-20 left-1/2 h-24 w-40 -translate-x-1/2" aria-hidden="true" />
        <div
          data-curtain
          className="h-2 w-[280px] max-w-[70vw] rounded-full bg-stage shadow-[0_0_24px_rgba(45,91,255,0.45)]"
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <span className="font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-stage">Get ready</span>
        <h1 className="font-serif text-[clamp(32px,8vw,52px)] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {title} is{' '}
          <span ref={verbRef} className="text-action-deep">
            {VERBS[verb]}
          </span>
        </h1>
      </div>

      <Show when={shown.length > 0}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Repeat each={[...shown]}>
            {(p, i) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3">
                <GameAvatar id={p.id} initial={p.name.charAt(0).toUpperCase()} size="sm" />
                <span className="font-sans text-[13px] font-bold text-ink-2">{p.name}</span>
                <span
                  className="h-2 w-2 rounded-full bg-action animate-[bob-dot_1.6s_ease-in-out_infinite]"
                  style={{ animationDelay: `${i * 220}ms` }}
                  aria-label="ready"
                />
              </span>
            )}
          </Repeat>
        </div>
      </Show>

      <p className="font-sans text-[13px] text-ink-4">Stretch your fingers. You&apos;re up next.</p>
    </div>
  );
}
