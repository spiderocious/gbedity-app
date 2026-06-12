import { useEffect, useRef, useState } from 'react';

import { log } from '../../../shared/observability/logger.ts';
import { LogEvent } from '../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';

// The shared, BACKEND-AUTHORITATIVE game flow stage machine — generalized from the Missing Letters
// reference so all games share ONE machine + a tiny per-game config (no 18× duplication).
//
//   intro+countdown (once, at game start, ONLY until the first real patch) →
//   [ round_start flash → playing ]  (per round, driven by a backend "playing" phase) →
//   reveal → round_scores  (two client stages over the backend "reveal" window) →
//   done
//
// Locked rules (learned from the ML build):
//  • The intro/countdown are a cosmetic overlay that ENDS the moment the first real patch arrives;
//    every backend phase maps straight to a stage. Interstitial timers never gate the live phase.
//  • The FIRST round goes straight to playing (no flash) so host+players sync to the backend
//    deadline; later rounds get the brief round-start flash.
//  • Same-round repeat patches (score ticks) never reset the stage.

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

export interface GameFlow {
  readonly stage: FlowStage;
  /** The active round index (0-based) from the patch. */
  readonly roundIndex: number;
  /** Called by the intro/countdown interstitials when their timer ends (game-start only). */
  readonly advance: () => void;
}

export interface GameFlowConfig {
  /** Backend phase names that mean "active play" (usually one, e.g. 'round' / 'question'). */
  readonly playingPhases: readonly string[];
  /** Backend phase names that mean "reveal the answer / between-round". */
  readonly revealPhases: readonly string[];
  /** Backend phase names that mean "game over". */
  readonly donePhases: readonly string[];
  /** Which patch field increments per round (idx / qIndex / roundIndex / round). Default 'idx'. */
  readonly roundKey?: string;
  /** Whether to show a round-scores stage after reveal. Default true. Some games (e.g. open-phase)
   *  go reveal → done with no per-round scores beat. */
  readonly hasRoundScores?: boolean;
}

const REVEAL_SPLIT = 0.45; // reveal beat gets the first slice of the backend reveal window; scores the rest.
const ROUND_START_FLASH_MS = 1100;

export function useGameFlow(patch: ViewPatch | null, config: GameFlowConfig): GameFlow {
  const {
    playingPhases,
    revealPhases,
    donePhases,
    roundKey = 'idx',
    hasRoundScores = true,
  } = config;

  const [stage, setStage] = useState<FlowStage>(FlowStage.INTRO);
  const sawFirstPatch = useRef(false);
  const lastPhase = useRef<string | null>(null);
  const lastIdx = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const roundStartTimer = useRef<number | null>(null);

  const idxRaw = patch ? (patch as Record<string, unknown>)[roundKey] : undefined;
  const idx = typeof idxRaw === 'number' ? idxRaw : 0;
  const phase = patch?.phase ?? null;
  const revealSeconds = typeof patch?.revealSeconds === 'number' ? patch.revealSeconds : 3;

  const stageFor = (p: string): FlowStage | null => {
    if (playingPhases.includes(p)) return FlowStage.PLAYING;
    if (revealPhases.includes(p)) return FlowStage.REVEAL;
    if (donePhases.includes(p)) return FlowStage.DONE;
    return null;
  };

  // Cosmetic intro chain: intro → countdown. Never reaches playing on its own — the backend does.
  const advance = (): void => {
    setStage((s) => {
      const next = s === FlowStage.INTRO ? FlowStage.COUNTDOWN : s;
      log.event(LogEvent.STAGE_ADVANCE_CALLED, { from: s, to: next }, { component: 'useGameFlow' });
      return next;
    });
  };

  // setStage wrapper that logs every transition with the reason (the crux of "stuck on a stage" bugs).
  const go = (to: FlowStage, why: string): void => {
    setStage((from) => {
      if (from !== to) log.event(LogEvent.STAGE_CHANGED, { from, to, why, phase, idx }, { component: 'useGameFlow' });
      return to;
    });
  };

  useEffect(() => {
    if (phase === null) {
      log.event(LogEvent.FLOW_NO_PATCH, { stage }, { component: 'useGameFlow' });
      return undefined;
    }

    const isFirst = !sawFirstPatch.current;
    sawFirstPatch.current = true;
    if (isFirst) log.event(LogEvent.STAGE_FIRST_PATCH, { phase, idx, stage }, { component: 'useGameFlow' });

    const target = stageFor(phase);
    const cameFromReveal = lastPhase.current !== null && revealPhases.includes(lastPhase.current);
    const newRound = lastIdx.current !== idx || cameFromReveal;
    log.event(
      LogEvent.STAGE_DECISION,
      { phase, idx, lastPhase: lastPhase.current, lastIdx: lastIdx.current, target, isFirst, newRound, cameFromReveal, stage, revealSeconds },
      { component: 'useGameFlow' },
    );

    if (target === null) {
      // A phase the flow doesn't map (e.g. a sub-phase) — hold the current stage.
      log.event(LogEvent.STAGE_UNMAPPED_PHASE, { phase, heldStage: stage, playingPhases, revealPhases, donePhases }, { component: 'useGameFlow' });
      lastPhase.current = phase;
      lastIdx.current = idx;
      return undefined;
    }

    if (target === FlowStage.PLAYING) {
      if (isFirst) {
        go(FlowStage.PLAYING, 'first-patch-straight-to-playing');
      } else if (newRound) {
        go(FlowStage.ROUND_START, 'new-round-flash');
        if (roundStartTimer.current) window.clearTimeout(roundStartTimer.current);
        log.event(LogEvent.STAGE_ROUND_START_TIMER, { armedMs: ROUND_START_FLASH_MS, idx }, { component: 'useGameFlow' });
        roundStartTimer.current = window.setTimeout(() => {
          log.event(LogEvent.STAGE_TIMER_FIRED, { timer: 'round_start', to: FlowStage.PLAYING, idx }, { component: 'useGameFlow' });
          go(FlowStage.PLAYING, 'round-start-timer-fired');
        }, ROUND_START_FLASH_MS);
      } else if (stage !== FlowStage.PLAYING && stage !== FlowStage.ROUND_START) {
        go(FlowStage.PLAYING, 'same-round-resync-to-playing');
      }
      // else: same round, already playing → no-op (score ticks shouldn't reset the stage).
    } else if (target === FlowStage.REVEAL && (lastPhase.current === null || !revealPhases.includes(lastPhase.current))) {
      go(FlowStage.REVEAL, 'entered-reveal');
      if (hasRoundScores) {
        const revealMs = revealSeconds * 1000;
        const fireIn = Math.max(700, revealMs * REVEAL_SPLIT);
        if (revealTimer.current) window.clearTimeout(revealTimer.current);
        log.event(LogEvent.STAGE_REVEAL_TIMER, { armedMs: fireIn, revealMs, idx }, { component: 'useGameFlow' });
        revealTimer.current = window.setTimeout(() => {
          log.event(LogEvent.STAGE_TIMER_FIRED, { timer: 'reveal', to: FlowStage.ROUND_SCORES, idx }, { component: 'useGameFlow' });
          go(FlowStage.ROUND_SCORES, 'reveal-timer-fired');
        }, fireIn);
      }
    } else if (target === FlowStage.DONE) {
      go(FlowStage.DONE, 'game-done');
    }

    lastPhase.current = phase;
    lastIdx.current = idx;
    return undefined;
  }, [phase, idx, revealSeconds, stage]);

  useEffect(
    () => () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (roundStartTimer.current) window.clearTimeout(roundStartTimer.current);
    },
    [],
  );

  return { stage, roundIndex: idx, advance };
}
