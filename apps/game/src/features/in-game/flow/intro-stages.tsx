import { useEffect, useRef } from 'react';

import { Card, Pill, SoundKey } from '@gbedity/ui';

import { CountdownNumerals } from './flow-primitives.tsx';
import { useCountdown } from './use-countdown.ts';
import { useOnMount, useTimeout } from './use-timeout.ts';

// Shared intro + countdown interstitials — every game's flow opens with the same cosmetic beats
// (title splash → 3·2·1), so they live here instead of being re-written per game.

export function IntroStage({
  title,
  description,
  meta,
  onDone,
  onMount,
  ms = 2600,
}: {
  readonly title: string;
  readonly description?: string;
  readonly meta?: string;
  readonly onDone: () => void;
  readonly onMount: () => void;
  readonly ms?: number;
}) {
  useOnMount(onMount);
  useTimeout(onDone, ms);
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-12 text-center">
      <Pill tone="action">Get ready</Pill>
      <h1 className="font-serif text-[clamp(40px,10vw,80px)] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">{title}</h1>
      {description !== undefined ? <p className="max-w-[42ch] font-sans text-[16px] text-ink-3">{description}</p> : null}
      {meta !== undefined ? <p className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-4">{meta}</p> : null}
    </Card>
  );
}

export function CountdownStage({ onDone, onTick }: { readonly onDone: () => void; readonly onTick: () => void }) {
  const count = useCountdown(3, onDone);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== count) {
      last.current = count;
      onTickRef.current();
    }
  }, [count]);
  return (
    <Card size="lg" className="flex flex-col items-center gap-2 py-12">
      <CountdownNumerals value={count} />
    </Card>
  );
}

export { SoundKey };
