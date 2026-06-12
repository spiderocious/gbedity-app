import { useEffect, useRef, useState } from 'react';

import { log } from '../../../../shared/observability/logger.ts';
import { LogEvent } from '../../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../../shared/types/view.ts';
import { Phase } from '../../../../shared/types/view.ts';

// The Missing Letters client flow machine — BACKEND-AUTHORITATIVE.
//
// The backend owns the round clock (absolute `deadline`). The client only adds two SHORT,
// NON-BLOCKING beats and otherwise mirrors the backend phase exactly:
//
//   intro+countdown (once, at game start, ONLY until the first real patch) →
//   [ round_start flash → playing ]  (per round, driven by backend `round`) →
//   reveal (letters) → round_scores  (two client stages over the backend `reveal` window) →
//   done
//
// Why this shape (fixes the "host stuck with no word" + "timing way off" bugs): the OLD machine
// ran ~6.7s of client interstitials that ate into the live round window and gated backend phases
// behind an `introDone` flag — so if the backend advanced during the intro, the client stranded on a
// stale `round` patch. Now: the intro is a brief cosmetic overlay that ENDS the moment a real patch
// arrives, and every backend phase change maps straight to a stage. The round timer the user sees is
// the backend `deadline`, so it can't desync.

export const FlowStage = {
  INTRO: 'intro',
  COUNTDOWN: 'countdown',
  ROUND_START: 'round_start',
  PLAYING: 'playing',
  REVEAL: 'reveal',
  ROUND_SCORES: 'round_scores',
  DONE: 'done',
} as const;
export type FlowStage = (typeof FlowStage)[keyof typeof FlowStage];

export interface MissingLettersFlow {
  readonly stage: FlowStage;
  readonly roundIndex: number;
  /** Called by the intro/countdown interstitials when their timer ends (game-start only). */
  readonly advance: () => void;
}

// Reveal letters get the first slice of the backend reveal window; round-scores the rest.
const REVEAL_SPLIT = 0.45;
const ROUND_START_FLASH_MS = 1100;

// Map a backend phase → a stage. COUNTDOWN is now a REAL backend phase (server-timed, shared
// deadline) — the 3·2·1·GO beat before round 1 — so it maps directly here instead of being a
// client-timer interstitial. round_start/round_scores are still layered on top by the hook.
function backendStage(phase: string | null): FlowStage | null {
  if (phase === Phase.COUNTDOWN) return FlowStage.COUNTDOWN;
  if (phase === Phase.ROUND) return FlowStage.PLAYING;
  if (phase === Phase.REVEAL) return FlowStage.REVEAL;
  if (phase === Phase.DONE) return FlowStage.DONE;
  return null;
}

export function useMissingLettersFlow(patch: ViewPatch | null): MissingLettersFlow {
  const [stage, setStage] = useState<FlowStage>(FlowStage.INTRO);
  const sawFirstPatch = useRef(false); // the intro overlay ends as soon as the backend speaks
  const lastPhase = useRef<string | null>(null);
  const lastIdx = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const roundStartTimer = useRef<number | null>(null);
  const stageRef = useRef<FlowStage>(stage); // current stage for transition logging (no extra deps)
  stageRef.current = stage;

  // Every stage transition flows through here so a capture shows from → to + WHY. This is the core
  // diagnostic for the "host stuck on Go!" bug: each setStage names its reason.
  const go = (next: FlowStage, reason: string): void => {
    setStage((prev) => {
      if (prev !== next) {
        log.event(LogEvent.STAGE_CHANGED, { from: prev, to: next, reason }, { component: 'useMissingLettersFlow' });
      }
      return next;
    });
  };

  useEffect(() => {
    log.event(LogEvent.STAGE_INIT, { initialStage: FlowStage.INTRO }, { component: 'useMissingLettersFlow' });
  }, []);

  const idx = typeof patch?.idx === 'number' ? patch.idx : 0;
  const phase = patch?.phase ?? null;

  // Game-start intro chain (cosmetic): intro → countdown. advance() steps it. It NEVER reaches
  // PLAYING on its own — the backend patch does (below). If no patch has arrived yet, the intro
  // simply holds; the moment one arrives, we snap to the backend phase.
  const advance = (): void => {
    log.event(LogEvent.STAGE_ADVANCE_CALLED, { stage: stageRef.current }, { component: 'useMissingLettersFlow' });
    setStage((s) => {
      if (s === FlowStage.INTRO) {
        log.event(LogEvent.STAGE_CHANGED, { from: s, to: FlowStage.COUNTDOWN, reason: 'advance()' }, { component: 'useMissingLettersFlow' });
        return FlowStage.COUNTDOWN;
      }
      return s; // countdown's end is a no-op; the backend patch drives the rest
    });
  };

  useEffect(() => {
    if (phase === null) return undefined;

    const isFirst = !sawFirstPatch.current;
    sawFirstPatch.current = true;

    const target = backendStage(phase);
    if (isFirst) {
      log.event(LogEvent.STAGE_FIRST_PATCH, { phase, idx, target, stageAtArrival: stageRef.current }, { component: 'useMissingLettersFlow' });
    }
    if (target === null) {
      lastPhase.current = phase;
      lastIdx.current = idx;
      return undefined;
    }

    // COUNTDOWN — the server-timed get-ready beat before round 1. The stage renders the 3·2·1·GO off
    // the patch's shared `deadline`, so every device counts together. The backend flips to `round`
    // when the countdown deadline fires (we don't time it client-side).
    if (target === FlowStage.COUNTDOWN) {
      if (stage !== FlowStage.COUNTDOWN) go(FlowStage.COUNTDOWN, 'backend-countdown');
      lastPhase.current = phase;
      lastIdx.current = idx;
      return undefined;
    }

    // ROUND.
    // First round: go STRAIGHT to the live word — no round-start flash. The COUNTDOWN beat already
    // served as round 1's "get ready", and a fixed-duration client flash here desyncs host vs
    // players (they enter it at slightly different times → leave it at different times → "host on
    // GO! while players see the word"). Going straight to the word syncs everyone to the backend
    // deadline. Subsequent rounds get the brief flash (a clear round marker; minor jitter is fine
    // mid-game). Same-round repeat patches (score ticks) never reset the stage.
    if (target === FlowStage.PLAYING) {
      const newRound = lastIdx.current !== idx || lastPhase.current === Phase.REVEAL;
      if (isFirst) {
        go(FlowStage.PLAYING, 'first-patch-round');
      } else if (newRound) {
        go(FlowStage.ROUND_START, `new-round idx ${String(lastIdx.current)}→${idx}`);
        if (roundStartTimer.current) window.clearTimeout(roundStartTimer.current);
        log.event(LogEvent.STAGE_ROUND_START_TIMER, { action: 'armed', ms: ROUND_START_FLASH_MS, idx }, { component: 'useMissingLettersFlow' });
        roundStartTimer.current = window.setTimeout(() => {
          log.event(LogEvent.STAGE_ROUND_START_TIMER, { action: 'fired', idx }, { component: 'useMissingLettersFlow' });
          go(FlowStage.PLAYING, 'round-start-timer');
        }, ROUND_START_FLASH_MS);
      } else if (stage !== FlowStage.PLAYING && stage !== FlowStage.ROUND_START) {
        go(FlowStage.PLAYING, 'same-round-resync');
      }
    } else if (target === FlowStage.REVEAL && lastPhase.current !== Phase.REVEAL) {
      // reveal letters, then auto-advance to round scores partway through the REAL reveal window.
      go(FlowStage.REVEAL, 'backend-reveal');
      const revealMs = (typeof patch?.revealSeconds === 'number' ? patch.revealSeconds : 3) * 1000;
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => go(FlowStage.ROUND_SCORES, 'reveal-split-timer'), Math.max(700, revealMs * REVEAL_SPLIT));
    } else if (target === FlowStage.DONE) {
      go(FlowStage.DONE, 'backend-done');
    }

    lastPhase.current = phase;
    lastIdx.current = idx;
    return undefined;
  }, [phase, idx, patch?.revealSeconds, stage]);

  useEffect(
    () => () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (roundStartTimer.current) window.clearTimeout(roundStartTimer.current);
    },
    [],
  );

  return { stage, roundIndex: idx, advance };
}
