import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../../../shared/services/api-error.ts';
import { invSoloApi, type InvAccuseResult, type InvCase } from './api.ts';
import { InvPhase } from './machine.ts';

// The brain for client-driven solo Investigation. Owns the whole flow with no socket: it draws the
// case, runs its own investigate countdown, collects the reasoned accusation, calls /accuse, and
// surfaces the reveal. The screens are pure; this hook is the only stateful piece.

interface State {
  phase: InvPhase;
  soloId: string | null;
  theCase: InvCase | null;
  investigateSeconds: number;
  secondsLeft: number;
  shownAt: number; // when the case was opened (for elapsedMs)
  result: InvAccuseResult | null;
  errorMessage: string | null;
}

const initial: State = {
  phase: InvPhase.STARTING,
  soloId: null,
  theCase: null,
  investigateSeconds: 300,
  secondsLeft: 300,
  shownAt: 0,
  result: null,
  errorMessage: null,
};

export interface InvestigationSolo {
  readonly phase: InvPhase;
  readonly theCase: InvCase | null;
  readonly investigateSeconds: number;
  readonly secondsLeft: number;
  readonly result: InvAccuseResult | null;
  readonly errorMessage: string | null;
  readonly openFile: () => void; // briefing → investigate (starts the clock)
  readonly toAccuse: () => void;
  readonly backToInvestigate: () => void;
  readonly submit: (a: { suspectId: string; evidenceId: string; confidence: string }) => void;
  readonly toFinal: () => void;
  readonly replay: () => void;
}

export function useInvestigationSolo(config?: Record<string, unknown>): InvestigationSolo {
  const [state, setState] = useState<State>(initial);
  const lockRef = useRef(false); // an accuse is in flight
  const configRef = useRef(config);
  configRef.current = config;

  const set = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  const begin = useCallback(() => {
    setState(initial);
    lockRef.current = false;
    void (async () => {
      try {
        const res = await invSoloApi.start(configRef.current);
        set({
          phase: InvPhase.BRIEFING,
          soloId: res.soloId,
          theCase: res.theCase,
          investigateSeconds: res.investigateSeconds,
          secondsLeft: res.investigateSeconds,
        });
      } catch (e) {
        set({ phase: InvPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not open a case.' });
      }
    })();
  }, [set]);

  // Draw a case on mount.
  useEffect(() => {
    begin();
  }, []);

  // Investigate countdown — ticks only during the INVESTIGATE/ACCUSE phases (the clock keeps running
  // while you build the accusation). At 0, auto-submit a timeout (a non-accusation → 0, reveals truth).
  useEffect(() => {
    if (state.phase !== InvPhase.INVESTIGATE && state.phase !== InvPhase.ACCUSE) return undefined;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== InvPhase.INVESTIGATE && s.phase !== InvPhase.ACCUSE) return s;
        const next = s.secondsLeft - 1;
        if (next <= 0) {
          if (!lockRef.current) void runAccuse('', '', 'solid');
          return { ...s, secondsLeft: 0 };
        }
        return { ...s, secondsLeft: next };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  const runAccuse = useCallback(
    async (suspectId: string, evidenceId: string, confidence: string) => {
      const soloId = state.soloId;
      if (!soloId || lockRef.current) return;
      lockRef.current = true;
      const elapsedMs = state.shownAt > 0 ? Date.now() - state.shownAt : 0;
      try {
        const result = await invSoloApi.accuse({ soloId, suspectId, evidenceId, confidence, elapsedMs });
        set({ phase: InvPhase.REVEAL, result });
      } catch (e) {
        lockRef.current = false;
        set({ phase: InvPhase.ERROR, errorMessage: e instanceof ApiError ? e.message : 'Could not submit your accusation.' });
      }
    },
    [set, state.soloId, state.shownAt],
  );

  const openFile = useCallback(() => set({ phase: InvPhase.INVESTIGATE, shownAt: Date.now() }), [set]);
  const toAccuse = useCallback(() => set({ phase: InvPhase.ACCUSE }), [set]);
  const backToInvestigate = useCallback(() => set({ phase: InvPhase.INVESTIGATE }), [set]);
  const submit = useCallback((a: { suspectId: string; evidenceId: string; confidence: string }) => void runAccuse(a.suspectId, a.evidenceId, a.confidence), [runAccuse]);
  const toFinal = useCallback(() => set({ phase: InvPhase.FINAL }), [set]);
  const replay = useCallback(() => begin(), [begin]);

  return {
    phase: state.phase,
    theCase: state.theCase,
    investigateSeconds: state.investigateSeconds,
    secondsLeft: state.secondsLeft,
    result: state.result,
    errorMessage: state.errorMessage,
    openFile,
    toAccuse,
    backToInvestigate,
    submit,
    toFinal,
    replay,
  };
}
