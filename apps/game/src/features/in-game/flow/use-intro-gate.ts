import { useEffect, useRef, useState } from 'react';

import { log } from '../../../shared/observability/logger.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';

// A minimal intro→countdown→live gate for the turn-based games (Word Bomb, Truth or Dare,
// Presentation, Millionaire) whose live body is driven directly off the backend phase rather than
// the round/reveal stage machine. The intro is cosmetic; the moment the first real patch arrives,
// `live` becomes true and the flow renders the phase-specific body. `advance()` steps intro→countdown.

export const IntroPhase = { INTRO: 'intro', COUNTDOWN: 'countdown', LIVE: 'live', DONE: 'done' } as const;
export type IntroPhase = (typeof IntroPhase)[keyof typeof IntroPhase];

export function useIntroGate(patch: ViewPatch | null, donePhases: readonly string[]): {
  readonly phase: IntroPhase;
  readonly advance: () => void;
} {
  const [phase, setPhase] = useState<IntroPhase>(IntroPhase.INTRO);
  const sawPatch = useRef(false);

  const backendPhase = patch?.phase ?? null;

  const advance = (): void => {
    setPhase((p) => {
      const next = p === IntroPhase.INTRO ? IntroPhase.COUNTDOWN : p;
      log.event(LogEvent.STAGE_ADVANCE_CALLED, { from: p, to: next }, { component: 'useIntroGate' });
      return next;
    });
  };

  const go = (to: IntroPhase, why: string): void => {
    setPhase((from) => {
      if (from !== to) log.event(LogEvent.STAGE_CHANGED, { from, to, why, backendPhase }, { component: 'useIntroGate' });
      return to;
    });
  };

  useEffect(() => {
    if (backendPhase === null) {
      log.event(LogEvent.FLOW_NO_PATCH, { phase }, { component: 'useIntroGate' });
      return;
    }
    if (donePhases.includes(backendPhase)) {
      go(IntroPhase.DONE, 'backend-done');
      return;
    }
    if (!sawPatch.current) {
      sawPatch.current = true;
      // first real patch ends the intro immediately (no flash), like the round games
      log.event(LogEvent.STAGE_FIRST_PATCH, { backendPhase }, { component: 'useIntroGate' });
      go(IntroPhase.LIVE, 'first-patch-straight-to-live');
      return;
    }
    go(IntroPhase.LIVE, 'live-resync');
  }, [backendPhase, donePhases]);

  return { phase, advance };
}
