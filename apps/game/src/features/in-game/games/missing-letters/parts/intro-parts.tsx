import { useRef } from 'react';

import { GameAvatar } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Repeat } from 'meemaw';

// Intro-specific decorative pieces for the "Get Ready" beat (Missing Letters). These are pure
// visual previews — NOT playable. They echo the in-game letter-tile aesthetic so the room sees what
// the game will look like before it starts. Kept colocated with the game (FSD: most-specific folder)
// until a second game's intro needs them.

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A teaser word, some letters revealed in Action Green, some left as dashed blanks — previewing the
// fill-the-word mechanic. Tiles cascade in on mount, then "breathe" (one random tile lifts every ~2s).
const TEASER: ReadonlyArray<{ readonly ch: string; readonly filled: boolean }> = [
  { ch: 'P', filled: true },
  { ch: 'L', filled: true },
  { ch: 'A', filled: false },
  { ch: 'Y', filled: false },
  { ch: 'E', filled: true },
  { ch: 'D', filled: false },
];

export function PreviewTiles() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || prefersReducedMotion()) return;
      const tiles = gsap.utils.toArray<HTMLElement>('[data-preview-tile]', root);

      // Cascade in left-to-right (drop from above with spring).
      gsap.fromTo(
        tiles,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.08, clearProps: 'transform' },
      );

      // Idle "breathing": one random tile lifts -2px and returns, every ~2s. Endless until unmount.
      const breathe = gsap.timeline({ repeat: -1, repeatDelay: 1.6, delay: tiles.length * 0.08 + 0.6 });
      breathe.to({}, { duration: 0 }); // anchor
      breathe.add(() => {
        const t = tiles[Math.floor((tiles.length - 1) * ((breathe.iteration() % tiles.length) / tiles.length))];
        if (t) gsap.to(t, { y: -2, duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      });
      return () => {
        breathe.kill();
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-center gap-2" aria-hidden="true">
      <Repeat each={[...TEASER]}>
        {(t, i) => (
          <span
            key={i}
            data-preview-tile
            className={`inline-flex h-14 w-11 items-center justify-center rounded-btn-sm font-serif text-[30px] font-semibold ${
              t.filled ? 'bg-action-soft text-action-deep' : 'border-2 border-dashed border-ink-4 text-transparent'
            }`}
          >
            {t.ch}
          </span>
        )}
      </Repeat>
    </div>
  );
}

// Setup summary chips — rounds / seconds-per-round / difficulty. Each value is real (from the live
// patch / configure step); omitted when unknown rather than faked.
export interface MetaChip {
  readonly label: string;
}

export function MetaChips({ chips }: { readonly chips: readonly MetaChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4">
      <Repeat each={[...chips]}>
        {(c, i) => (
          <span key={c.label} className="inline-flex items-center gap-3">
            {i > 0 ? <span className="text-ink-5" aria-hidden="true">·</span> : null}
            {c.label}
          </span>
        )}
      </Repeat>
    </div>
  );
}

// Player check-in strip — avatar + name + a pulsing "ready" dot. Tells the room who's here and
// settling in. Renders nothing if no roster yet (the intro still works without it).
export interface CheckInPlayer {
  readonly id: string;
  readonly name: string;
}

export function CheckInRow({ players }: { readonly players: readonly CheckInPlayer[] }) {
  if (players.length === 0) return null;
  const shown = players.slice(0, 5);
  const extra = players.length - shown.length;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Repeat each={[...shown]}>
        {(p, i) => (
          <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-canvas py-1 pl-1 pr-3">
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
      {extra > 0 ? <span className="font-sans text-[13px] font-bold text-ink-4">+{extra}</span> : null}
    </div>
  );
}
