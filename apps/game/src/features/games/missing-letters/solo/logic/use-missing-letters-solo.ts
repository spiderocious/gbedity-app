import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../../../shared/services/api-error.ts';
import { mlSoloApi, type MlGuessResult, type MlRoundView } from './api.ts';
import { COUNTDOWN_SECONDS, MlPhase } from './machine.ts';

// The brain for client-driven solo Missing Letters. Owns the whole flow with no socket: it calls the
// REST API, runs its own per-round countdown, holds the phase + current round + guess + score, and
// reports timing (shown → submitted) so the server can score by speed. The screens are pure; this
// hook is the only stateful piece. See docs/specs/solo-games-playbook.md §6.

interface State {
  phase: MlPhase;
  soloId: string | null;
  round: MlRoundView | null;
  rounds: number;
  guess: string;
  countdown: number; // seconds left in the pre-round 3·2·1 beat
  secondsLeft: number; // seconds left in the live round
  result: MlGuessResult | null; // the last round's reveal
  totalScore: number;
  correctCount: number;
  errorMessage: string | null;
}

const initialState: State = {
  phase: MlPhase.INTRO,
  soloId: null,
  round: null,
  rounds: 0,
  guess: '',
  countdown: COUNTDOWN_SECONDS,
  secondsLeft: 0,
  result: null,
  totalScore: 0,
  correctCount: 0,
  errorMessage: null,
};

export interface MissingLettersSolo {
  readonly phase: MlPhase;
  readonly round: MlRoundView | null;
  readonly rounds: number;
  readonly guess: string;
  readonly countdown: number;
  readonly secondsLeft: number;
  readonly result: MlGuessResult | null;
  readonly totalScore: number;
  readonly correctCount: number;
  readonly errorMessage: string | null;
  readonly start: () => void;
  readonly setGuess: (value: string) => void;
  readonly submit: () => void;
  readonly continueNext: () => void;
  readonly replay: () => void;
}

export function useMissingLettersSolo(config?: Record<string, unknown>): MissingLettersSolo {
  const [state, setState] = useState<State>(initialState);
  // Refs the timers read so the interval callbacks never close over stale state.
  const shownAtRef = useRef<number>(0); // when the current round's word was shown (for elapsedMs)
  const lockRef = useRef(false); // a submit/timeout is in flight → ignore further input this round
  const configRef = useRef(config);
  configRef.current = config;

  const set = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  // ── Fetch a round and begin the live timer (called after the countdown) ───────
  const beginRound = useCallback(
    async (soloId: string) => {
      try {
        const round = await mlSoloApi.round(soloId);
        lockRef.current = false;
        shownAtRef.current = Date.now();
        set({ phase: MlPhase.PLAYING, round, secondsLeft: round.secondsPerRound, guess: '' });
      } catch (e) {
        set({ phase: MlPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not load the round.' });
      }
    },
    [set],
  );

  // ── Resolve the current round (a real guess OR a timeout) and show the reveal ──
  const resolve = useCallback(
    async (timeout: boolean) => {
      const soloId = state.soloId;
      if (!soloId || lockRef.current) return;
      lockRef.current = true;
      const elapsedMs = Date.now() - shownAtRef.current;
      const text = state.guess.trim();
      // An empty manual submit shouldn't happen (button is disabled), but guard it as a timeout.
      const asTimeout = timeout || text === '';
      try {
        const result = await mlSoloApi.guess(soloId, text, elapsedMs, asTimeout);
        set({
          phase: MlPhase.REVEAL,
          result,
          totalScore: result.totalScore,
          correctCount: state.correctCount + (result.correct ? 1 : 0),
        });
      } catch (e) {
        set({ phase: MlPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not submit your guess.' });
      }
    },
    [set, state.soloId, state.guess, state.correctCount],
  );

  // ── Live round timer: tick down secondsLeft; at 0, auto-resolve as a timeout ───
  useEffect(() => {
    if (state.phase !== MlPhase.PLAYING) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== MlPhase.PLAYING) return s;
        const next = s.secondsLeft - 0.1;
        if (next <= 0) {
          // Fire the timeout once (lockRef guards against double-resolve).
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
    if (state.phase !== MlPhase.COUNTDOWN) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== MlPhase.COUNTDOWN) return s;
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
    set({ phase: MlPhase.STARTING, errorMessage: null });
    void (async () => {
      try {
        const res = await mlSoloApi.start(configRef.current);
        set({ soloId: res.soloId, rounds: res.rounds, phase: MlPhase.COUNTDOWN, countdown: COUNTDOWN_SECONDS });
      } catch (e) {
        set({ phase: MlPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not start the game.' });
      }
    })();
  }, [set]);

  const setGuess = useCallback((value: string) => set({ guess: value }), [set]);

  const submit = useCallback(() => {
    void resolve(false);
  }, [resolve]);

  // After a reveal, advance: POST /next → either the next countdown or the final screen.
  const continueNext = useCallback(() => {
    const soloId = state.soloId;
    if (!soloId) return;
    void (async () => {
      try {
        const res = await mlSoloApi.next(soloId);
        if (res.done) {
          set({ phase: MlPhase.FINAL, totalScore: res.totalScore });
        } else {
          set({ phase: MlPhase.COUNTDOWN, countdown: COUNTDOWN_SECONDS, round: null, result: null });
        }
      } catch (e) {
        set({ phase: MlPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not continue.' });
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
    guess: state.guess,
    countdown: state.countdown,
    secondsLeft: state.secondsLeft,
    result: state.result,
    totalScore: state.totalScore,
    correctCount: state.correctCount,
    errorMessage: state.errorMessage,
    start,
    setGuess,
    submit,
    continueNext,
    replay,
  };
}
