import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../../../shared/services/api-error.ts';
import { wsSoloApi, type WsGuessResult, type WsRoundView } from './api.ts';
import { COUNTDOWN_SECONDS, WsPhase } from './machine.ts';

// The brain for client-driven solo Wordshot. Owns the whole flow with no socket: it calls the REST
// API, runs its own per-round countdown, holds the phase + current round + word input + score, and
// reports timing (shown → submitted) so the server can score by speed. The screens are pure; this
// hook is the only stateful piece. See docs/specs/solo-games-playbook.md §6.

interface State {
  phase: WsPhase;
  soloId: string | null;
  round: WsRoundView | null;
  rounds: number;
  word: string;                // the current input value
  submittedWord: string;       // captured at submission time — stays on the reveal screen
  countdown: number;           // seconds left in the pre-round beat
  secondsLeft: number;         // seconds left in the live round
  result: WsGuessResult | null; // the last round's reveal
  totalScore: number;
  correctCount: number;
  errorMessage: string | null;
}

const initialState: State = {
  phase: WsPhase.INTRO,
  soloId: null,
  round: null,
  rounds: 0,
  word: '',
  submittedWord: '',
  countdown: COUNTDOWN_SECONDS,
  secondsLeft: 0,
  result: null,
  totalScore: 0,
  correctCount: 0,
  errorMessage: null,
};

export interface WordshotSolo {
  readonly phase: WsPhase;
  readonly round: WsRoundView | null;
  readonly rounds: number;
  readonly word: string;
  readonly submittedWord: string;
  readonly countdown: number;
  readonly secondsLeft: number;
  readonly result: WsGuessResult | null;
  readonly totalScore: number;
  readonly correctCount: number;
  readonly errorMessage: string | null;
  readonly start: () => void;
  readonly setWord: (value: string) => void;
  readonly submit: () => void;
  readonly continueNext: () => void;
  readonly replay: () => void;
}

export function useWordshot(config?: Record<string, unknown>): WordshotSolo {
  const [state, setState] = useState<State>(initialState);
  const shownAtRef = useRef<number>(0); // when the current round was shown (for elapsedMs)
  const lockRef = useRef(false);        // a submit/timeout is in flight → ignore further input
  const configRef = useRef(config);
  configRef.current = config;

  const set = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  // ── Fetch a round and begin the live timer ────────────────────────────────────
  const beginRound = useCallback(
    async (soloId: string) => {
      try {
        const round = await wsSoloApi.round(soloId);
        lockRef.current = false;
        shownAtRef.current = Date.now();
        set({ phase: WsPhase.PLAYING, round, secondsLeft: round.secondsPerRound, word: '' });
      } catch (e) {
        set({ phase: WsPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not load the round.' });
      }
    },
    [set],
  );

  // ── Resolve the round (real word OR timeout) and show the reveal ──────────────
  const resolve = useCallback(
    async (timeout: boolean) => {
      const soloId = state.soloId;
      if (!soloId || lockRef.current) return;
      lockRef.current = true;
      const elapsedMs = Date.now() - shownAtRef.current;
      const text = state.word.trim();
      const asTimeout = timeout || text === '';
      try {
        const result = await wsSoloApi.guess(soloId, text, elapsedMs, asTimeout);
        set({
          phase: WsPhase.REVEAL,
          result,
          submittedWord: text,
          totalScore: result.totalScore,
          correctCount: state.correctCount + (result.correct ? 1 : 0),
        });
      } catch (e) {
        set({ phase: WsPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not submit your word.' });
      }
    },
    [set, state.soloId, state.word, state.correctCount],
  );

  // ── Live round timer: tick down; at 0, auto-resolve as a timeout ───────────────
  useEffect(() => {
    if (state.phase !== WsPhase.PLAYING) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== WsPhase.PLAYING) return s;
        const next = s.secondsLeft - 0.1;
        if (next <= 0) {
          void resolve(true);
          return { ...s, secondsLeft: 0 };
        }
        return { ...s, secondsLeft: next };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [state.phase, resolve]);

  // ── Countdown beat: 3·2·1, then fetch the round ───────────────────────────────
  useEffect(() => {
    if (state.phase !== WsPhase.COUNTDOWN) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== WsPhase.COUNTDOWN) return s;
        const next = s.countdown - 1;
        if (next <= 0) {
          if (s.soloId) void beginRound(s.soloId);
          return { ...s, countdown: 0 };
        }
        return { ...s, countdown: next };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.phase, beginRound]);

  // ── Public actions ────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    set({ phase: WsPhase.STARTING, errorMessage: null });
    void (async () => {
      try {
        const res = await wsSoloApi.start(configRef.current);
        set({ soloId: res.soloId, rounds: res.rounds, phase: WsPhase.COUNTDOWN, countdown: COUNTDOWN_SECONDS });
      } catch (e) {
        set({ phase: WsPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not start the game.' });
      }
    })();
  }, [set]);

  const setWord = useCallback((value: string) => set({ word: value }), [set]);

  const submit = useCallback(() => {
    void resolve(false);
  }, [resolve]);

  // After a reveal, advance: POST /next → next countdown or final screen.
  const continueNext = useCallback(() => {
    const soloId = state.soloId;
    if (!soloId) return;
    void (async () => {
      try {
        const res = await wsSoloApi.next(soloId);
        if (res.done) {
          set({ phase: WsPhase.FINAL, totalScore: res.totalScore });
        } else {
          set({ phase: WsPhase.COUNTDOWN, countdown: COUNTDOWN_SECONDS, round: null, result: null });
        }
      } catch (e) {
        set({ phase: WsPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not continue.' });
      }
    })();
  }, [set, state.soloId]);

  const replay = useCallback(() => {
    setState(initialState);
    start();
  }, [start]);

  return {
    phase: state.phase,
    round: state.round,
    rounds: state.rounds,
    word: state.word,
    submittedWord: state.submittedWord,
    countdown: state.countdown,
    secondsLeft: state.secondsLeft,
    result: state.result,
    totalScore: state.totalScore,
    correctCount: state.correctCount,
    errorMessage: state.errorMessage,
    start,
    setWord,
    submit,
    continueNext,
    replay,
  };
}
