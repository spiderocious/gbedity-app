import { useRef } from 'react';

import { Card } from '@gbedity/ui';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { NIGHTS, type NightCard } from '../../shared/nights.ts';

gsap.registerPlugin(ScrollTrigger);

// The "who is this for" answer — three occasion cards. Object-only lucide glyphs (no
// faces) per branding §5. Cards reveal on scroll-in (staggered fade-up), reduced-motion
// gated by GSAP's matchMedia.
export function MadeForNights() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-night-card]', {
          opacity: 0,
          y: 24,
          duration: 0.45,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="nights-title"
      className="mx-auto w-full max-w-6xl px-6 py-12"
    >
      <h2
        id="nights-title"
        className="mb-8 text-center font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink sm:text-[34px]"
      >
        Made for nights like these
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {NIGHTS.map((night) => (
          <NightTile key={night.key} night={night} />
        ))}
      </div>
    </section>
  );
}

interface NightTileProps {
  readonly night: NightCard;
}

function NightTile({ night }: NightTileProps) {
  const Icon = night.icon;
  return (
    <Card size="lg" tone="canvas" className="flex flex-col" data-night-card data-monkey-perch>
      <span
        aria-hidden="true"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink"
      >
        <Icon size={24} />
      </span>
      <h3 className="mt-4 font-serif text-[20px] font-semibold tracking-[-0.005em] text-ink">
        {night.title}
      </h3>
      <p className="mt-2 font-sans text-[14px] leading-[1.5] text-ink-3">{night.body}</p>
    </Card>
  );
}
