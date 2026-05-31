import { useCallback, useEffect, useRef, useState } from 'react';

import { Monkey, type MonkeyTone } from './monkey.tsx';

// RoamingMonkeys — a few flat-vector monkeys that perch on the top edge of tagged cards
// and hop between them every few seconds. Targets are any element carrying the
// `data-monkey-perch` attribute (see PERCH_ATTR). Positions are read from
// getBoundingClientRect and kept glued on scroll/resize. Reduced-motion: monkeys sit
// still on their starting perches and never hop.
//
// This is decorative chrome — the overlay is fixed, pointer-events-none, aria-hidden.

export const PERCH_ATTR = 'data-monkey-perch';

const MONKEY_COUNT = 3;
const MONKEY_SIZE = 52;
const HOP_INTERVAL_MS = 3200;
const TONES: readonly MonkeyTone[] = ['ink', 'special', 'accent'];

interface Perch {
  /** viewport-relative top-left of where the monkey should sit (already offset up). */
  readonly top: number;
  readonly left: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Read the current perch geometry for every tagged element, in document order. */
function readPerches(): Perch[] {
  if (typeof document === 'undefined') return [];
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[${PERCH_ATTR}]`));
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      // Sit straddling the top edge, nudged in from the right corner so it reads as
      // "perched on" the card rather than floating above its centre.
      top: r.top - MONKEY_SIZE * 0.66,
      left: r.right - MONKEY_SIZE * 1.6,
    };
  });
}

export function RoamingMonkeys() {
  // Which perch index each monkey currently occupies.
  const [assignments, setAssignments] = useState<number[]>(() =>
    Array.from({ length: MONKEY_COUNT }, (_, i) => i),
  );
  const [perches, setPerches] = useState<Perch[]>([]);
  const reduced = useRef(false);

  const refresh = useCallback(() => {
    setPerches(readPerches());
  }, []);

  // Measure perches on mount + whenever layout can change (scroll, resize, font load).
  useEffect(() => {
    reduced.current = prefersReducedMotion();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Re-measure when card sizes change (filtering, font swap, image load, etc.).
    const ro = new ResizeObserver(schedule);
    document.querySelectorAll(`[${PERCH_ATTR}]`).forEach((el) => ro.observe(el));

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [refresh]);

  // Hop: every interval, move each monkey to a different perch (spread out, no two on the
  // same perch when there are enough perches). Skipped entirely under reduced-motion.
  useEffect(() => {
    if (reduced.current) return undefined;
    if (perches.length === 0) return undefined;

    const timer = window.setInterval(() => {
      setAssignments((prev) => nextAssignments(prev, perches.length));
    }, HOP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [perches.length]);

  if (perches.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[40] overflow-hidden">
      {assignments.map((perchIndex, monkeyIndex) => {
        const perch = perches[perchIndex] ?? perches[0];
        if (perch === undefined) return null;
        return (
          <div
            key={monkeyIndex}
            className="absolute will-change-transform"
            style={{
              top: 0,
              left: 0,
              transform: `translate3d(${perch.left}px, ${perch.top}px, 0)`,
              transition: reduced.current
                ? 'none'
                : 'transform 650ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div className="animate-[monkey-bob_2.4s_ease-in-out_infinite]">
              <Monkey size={MONKEY_SIZE} tone={TONES[monkeyIndex % TONES.length]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Pick a fresh perch for each monkey: rotate forward so they keep moving, and when there
// are at least MONKEY_COUNT perches, keep them on distinct perches.
function nextAssignments(prev: number[], perchCount: number): number[] {
  if (perchCount <= 1) return prev.map(() => 0);
  const used = new Set<number>();
  return prev.map((current) => {
    let next = (current + 1 + Math.floor(current * 7)) % perchCount;
    // Find the next unused perch if we can keep them distinct.
    if (perchCount >= prev.length) {
      let guard = 0;
      while (used.has(next) && guard < perchCount) {
        next = (next + 1) % perchCount;
        guard += 1;
      }
    }
    used.add(next);
    return next;
  });
}
