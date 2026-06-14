import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../../../shared/services/api-error.ts';
import { wwtbamSoloApi, type WwtbamAnswerResult, type WwtbamQuestionView } from './api.ts';
import { COUNTDOWN_SECONDS, WwtbamPhase } from './machine.ts';

// The brain for client-driven solo WWTBAM. Owns the whole flow with no socket: calls the REST API,
// runs its own countdown between questions, holds the phase + current question + selected choice +
// totals. Screens are pure; this hook is the only stateful piece. See solo-games-playbook.md §6.
//
// Key WWTBAM rules encoded here:
//   - A wrong answer (or timeout) → eliminated → game ends after the reveal.
//   - 50/50 is a one-shot server call; the returned hidden indices are stored locally.
//   - The client sends `timeout:true` when the timer expires (the backend ignores the choiceIdx then).
//   - After a correct answer the player taps "Continue playing" → next countdown → next question.
//   - After elimination the player taps "See final score" → FINAL directly (no /next needed).

interface State {
  phase: WwtbamPhase;
  soloId: string | null;
  question: WwtbamQuestionView | null;
  questionCount: number;
  countdown: number;
  secondsLeft: number;
  selectedIdx: number | null;  // what the player tapped (before reveal)
  hiddenOptions: number[];      // 50/50 result (indices to hide)
  result: WwtbamAnswerResult | null;
  totalBanked: number;
  correctCount: number;
  errorMessage: string | null;
}

const initialState: State = {
  phase: WwtbamPhase.INTRO,
  soloId: null,
  question: null,
  questionCount: 0,
  countdown: COUNTDOWN_SECONDS,
  secondsLeft: 0,
  selectedIdx: null,
  hiddenOptions: [],
  result: null,
  totalBanked: 0,
  correctCount: 0,
  errorMessage: null,
};

export interface WwtbamSolo {
  readonly phase: WwtbamPhase;
  readonly question: WwtbamQuestionView | null;
  readonly questionCount: number;
  readonly countdown: number;
  readonly secondsLeft: number;
  readonly selectedIdx: number | null;
  readonly hiddenOptions: number[];
  readonly result: WwtbamAnswerResult | null;
  readonly totalBanked: number;
  readonly correctCount: number;
  readonly errorMessage: string | null;
  readonly start: () => void;
  readonly selectOption: (idx: number) => void;
  readonly useFiftyFifty: () => void;
  readonly continueNext: () => void;
  readonly goToFinal: () => void;
  readonly replay: () => void;
}

export function useWwtbamSolo(config?: Record<string, unknown>): WwtbamSolo {
  const [state, setState] = useState<State>(initialState);
  const lockRef = useRef(false); // guard against double-resolve in the same round
  const configRef = useRef(config);
  configRef.current = config;

  const set = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  // ── Fetch the current question and start the live timer ───────────────────────
  const beginQuestion = useCallback(
    async (soloId: string) => {
      try {
        const question = await wwtbamSoloApi.question(soloId);
        lockRef.current = false;
        set({
          phase: WwtbamPhase.PLAYING,
          question,
          secondsLeft: question.secondsPerQuestion,
          selectedIdx: null,
        });
      } catch (e) {
        set({
          phase: WwtbamPhase.ERROR,
          errorMessage: e instanceof ApiError ? e.message : 'Could not load the question.',
        });
      }
    },
    [set],
  );

  // ── Submit an answer (player tap or client-side timeout) ──────────────────────
  const resolve = useCallback(
    async (choiceIdx: number, timeout: boolean) => {
      const soloId = state.soloId;
      if (!soloId || lockRef.current) return;
      lockRef.current = true;
      try {
        const result = await wwtbamSoloApi.answer(soloId, choiceIdx, timeout);
        set({
          phase: WwtbamPhase.REVEAL,
          result,
          totalBanked: result.totalBanked,
          correctCount: state.correctCount + (result.correct ? 1 : 0),
        });
      } catch (e) {
        set({
          phase: WwtbamPhase.ERROR,
          errorMessage: e instanceof ApiError ? e.message : 'Could not submit your answer.',
        });
      }
    },
    [set, state.soloId, state.correctCount],
  );

  // ── Live question timer: ticks every 100ms; auto-resolves as timeout at 0 ─────
  useEffect(() => {
    if (state.phase !== WwtbamPhase.PLAYING) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== WwtbamPhase.PLAYING) return s;
        const next = s.secondsLeft - 0.1;
        if (next <= 0) {
          void resolve(-1, true);
          return { ...s, secondsLeft: 0 };
        }
        return { ...s, secondsLeft: next };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [state.phase, resolve]);

  // ── Countdown beat: 3·2·1 then fetch the question ────────────────────────────
  useEffect(() => {
    if (state.phase !== WwtbamPhase.COUNTDOWN) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== WwtbamPhase.COUNTDOWN) return s;
        const next = s.countdown - 1;
        if (next <= 0) {
          if (s.soloId) void beginQuestion(s.soloId);
          return { ...s, countdown: 0 };
        }
        return { ...s, countdown: next };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.phase, beginQuestion]);

  // ── Public actions ────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    set({ phase: WwtbamPhase.STARTING, errorMessage: null });
    void (async () => {
      try {
        const res = await wwtbamSoloApi.start(configRef.current);
        set({
          soloId: res.soloId,
          questionCount: res.questionCount,
          phase: WwtbamPhase.COUNTDOWN,
          countdown: COUNTDOWN_SECONDS,
        });
      } catch (e) {
        set({
          phase: WwtbamPhase.ERROR,
          errorMessage: e instanceof ApiError ? e.message : 'Could not start the game.',
        });
      }
    })();
  }, [set]);

  // Player taps an option → mark it selected + immediately resolve (WWTBAM is tap-to-answer).
  const selectOption = useCallback(
    (idx: number) => {
      if (state.phase !== WwtbamPhase.PLAYING || lockRef.current) return;
      set({ selectedIdx: idx });
      void resolve(idx, false);
    },
    [state.phase, set, resolve],
  );

  // 50/50 lifeline — one-shot server call; store the hidden indices locally.
  const useFiftyFifty = useCallback(() => {
    const soloId = state.soloId;
    if (!soloId || state.phase !== WwtbamPhase.PLAYING) return;
    void (async () => {
      try {
        const res = await wwtbamSoloApi.fiftyFifty(soloId);
        set({ hiddenOptions: [...res.hidden] });
      } catch {
        // Silently ignore (lifeline already used or game over — server returns 409).
      }
    })();
  }, [set, state.soloId, state.phase]);

  // After a correct reveal: POST /next → either next countdown or FINAL.
  const continueNext = useCallback(() => {
    const soloId = state.soloId;
    if (!soloId) return;
    void (async () => {
      try {
        const res = await wwtbamSoloApi.next(soloId);
        if (res.done) {
          set({ phase: WwtbamPhase.FINAL, totalBanked: res.totalBanked });
        } else {
          set({
            phase: WwtbamPhase.COUNTDOWN,
            countdown: COUNTDOWN_SECONDS,
            question: null,
            result: null,
            hiddenOptions: [],
            selectedIdx: null,
          });
        }
      } catch (e) {
        set({
          phase: WwtbamPhase.ERROR,
          errorMessage: e instanceof ApiError ? e.message : 'Could not continue.',
        });
      }
    })();
  }, [set, state.soloId]);

  // After wrong-answer reveal: skip /next, go straight to FINAL with whatever was banked.
  const goToFinal = useCallback(() => {
    set({ phase: WwtbamPhase.FINAL });
  }, [set]);

  const replay = useCallback(() => {
    setState(initialState);
    start();
  }, [start]);

  return {
    phase: state.phase,
    question: state.question,
    questionCount: state.questionCount,
    countdown: state.countdown,
    secondsLeft: state.secondsLeft,
    selectedIdx: state.selectedIdx,
    hiddenOptions: state.hiddenOptions,
    result: state.result,
    totalBanked: state.totalBanked,
    correctCount: state.correctCount,
    errorMessage: state.errorMessage,
    start,
    selectOption,
    useFiftyFifty,
    continueNext,
    goToFinal,
    replay,
  };
}
