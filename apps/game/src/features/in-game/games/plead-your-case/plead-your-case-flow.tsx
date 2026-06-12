import { useEffect, useState } from 'react';

import { Button, Card, SoundKey, useSound } from '@gbedity/ui';

import { findGame, useCatalogue } from '../../../../shared/catalogue/index.ts';
import { useLobby } from '../../../../shared/api/use-lobby.ts';
import { log, useLogMount } from '../../../../shared/observability/logger.ts';
import { LogEvent } from '../../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../../shared/types/view.ts';
import { StageTransition, TimerBar } from '../../flow/flow-primitives.tsx';
import { CountdownStage, IntroStage } from '../../flow/intro-stages.tsx';
import { StandingsCard } from '../../flow/turn-primitives.tsx';
import { IntroPhase, useIntroGate } from '../../flow/use-intro-gate.ts';
import { useFlowDebug } from '../../flow/use-flow-debug.ts';
import type { GameFlowProps } from '../../flow/flow-registry.tsx';

// Plead Your Case animated flow — write a legal defence to a scenario; an AI scores it on a rubric;
// the round reveals the ranked verdicts. Phases: writing / evaluating / reveal / done.

const DONE = ['done'] as const;
const SUBMIT = 'plead.submit';

export function PleadYourCaseFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('PleadYourCaseFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('PleadYourCaseFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, submitted: patch?.submitted, winnerId: patch?.winnerId });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'plead_your_case');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Plead Your Case'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : phase === IntroPhase.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : phase === IntroPhase.DONE ? (
        <DoneStage patch={patch} nameOf={nameOf} />
      ) : (
        <LiveBody patch={patch} send={send} audience={audience} play={play} nameOf={nameOf} />
      )}
    </StageTransition>
  );
}

function LiveBody({
  patch,
  send,
  audience,
  play,
  nameOf,
}: {
  readonly patch: ViewPatch | null;
  readonly send: (a: Record<string, unknown>) => void;
  readonly audience: GameFlowProps['audience'];
  readonly play: (k: SoundKey) => void;
  readonly nameOf: (id: string) => string;
}) {
  const [text, setText] = useState('');
  const phase = typeof patch?.phase === 'string' ? patch.phase : '';
  const scenario = patch?.scenario;
  const submitted = patch?.submitted === true;
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 300000;
  const roundIndex = typeof patch?.roundIndex === 'number' ? patch.roundIndex : 0;
  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;
  const results = Array.isArray(patch?.results) ? patch.results : [];
  const winnerId = typeof patch?.winnerId === 'string' ? patch.winnerId : null;
  const isWriting = phase === 'writing';
  const isEvaluating = phase === 'evaluating';
  const isReveal = phase === 'reveal';

  useEffect(() => {
    setText('');
  }, [roundIndex]);

  function submit(): void {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty' }, { component: 'PleadYourCaseFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: SUBMIT, len: value.length }, { component: 'PleadYourCaseFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: SUBMIT, argument: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Case {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined && isWriting ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      {scenario !== undefined && scenario !== null ? (
        <Card size="lg" className="flex flex-col gap-2 py-6">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-danger-deep">Charge</span>
          <p className="font-serif text-[20px] font-semibold text-ink">{scenario.charge ?? ''}</p>
          {scenario.defendant !== undefined ? <p className="font-sans text-[14px] text-ink-3">Defendant: {scenario.defendant}</p> : null}
          {scenario.facts !== undefined ? <p className="font-sans text-[14px] leading-[1.6] text-ink-2">{scenario.facts}</p> : null}
          {scenario.laws !== undefined ? <p className="font-sans text-[13px] text-ink-3"><span className="font-bold">Laws:</span> {scenario.laws}</p> : null}
          {scenario.precedents !== undefined ? <p className="font-sans text-[13px] text-ink-3"><span className="font-bold">Precedents:</span> {scenario.precedents}</p> : null}
        </Card>
      ) : null}

      {isWriting ? (
        interactive ? (
          submitted ? (
            <p className="text-center font-sans text-[15px] font-bold text-action-deep">Defence submitted ✓</p>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Make your case, counsel…"
                autoComplete="off"
                className="resize-none rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] leading-[1.6] text-ink focus:border-action focus:outline-none"
              />
              <Button variant="primary" size="lg" onClick={submit}>
                Submit defence
              </Button>
            </div>
          )
        ) : (
          <p className="text-center font-sans text-[14px] text-ink-3">Counsel are writing their defences…</p>
        )
      ) : null}

      {isEvaluating ? (
        <Card size="lg" className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-[40px]" aria-hidden>
            ⚖️
          </span>
          <p className="font-serif text-[20px] font-semibold text-ink">The court is deliberating…</p>
          <p className="font-sans text-[14px] text-ink-3">An AI judge is scoring each defence on the rubric.</p>
        </Card>
      ) : null}

      {isReveal ? (
        <Card size="lg" className="flex flex-col gap-3 py-5">
          <span className="text-center font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">The verdict</span>
          {results.map((r, i) => {
            const pid = typeof r.playerId === 'string' ? r.playerId : '';
            const won = pid !== '' && pid === winnerId;
            return (
              <div key={pid || i} className={`flex items-center justify-between gap-3 rounded-card border-2 px-4 py-3 ${won ? 'border-action bg-action-soft' : 'border-ink-5 bg-surface'}`}>
                <span className="font-sans text-[15px] font-semibold text-ink">
                  {won ? '🏆 ' : ''}
                  {pid ? nameOf(pid) : '—'}
                </span>
                <span className="font-sans text-[14px] font-bold text-action-deep">{r.ok === false ? 'eval failed' : `${r.total ?? 0}`}</span>
              </div>
            );
          })}
        </Card>
      ) : null}

      <StandingsCard patch={patch} nameOf={nameOf} />
    </div>
  );
}

function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">Court adjourned</h2>
      <StandingsCard patch={patch} nameOf={nameOf} title="Final scores" />
    </Card>
  );
}
