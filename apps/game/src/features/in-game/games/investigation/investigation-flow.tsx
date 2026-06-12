import { Card, SoundKey, useSound } from '@gbedity/ui';

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

// Investigation animated flow — OPEN_PHASE. A case file (brief, suspects, evidence, timeline) to
// explore at your own pace; privately accuse a suspect before the window closes; the truth is
// revealed at the end. Phases: investigate / reveal / done.

const DONE = ['done'] as const;
const ACCUSE = 'investigation.accuse';

export function InvestigationFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('InvestigationFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('InvestigationFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, yourAccusation: patch?.yourAccusation, hasSolution: typeof patch?.solutionSuspectId === 'string' });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'investigation');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Investigation'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const phase = typeof patch?.phase === 'string' ? patch.phase : '';
  const title = typeof patch?.title === 'string' ? patch.title : '';
  const brief = typeof patch?.brief === 'string' ? patch.brief : '';
  const suspects = Array.isArray(patch?.suspects) ? patch.suspects : [];
  const evidence = Array.isArray(patch?.evidence) ? patch.evidence : [];
  const timeline = Array.isArray(patch?.timeline) ? (patch.timeline as string[]) : [];
  const yourAccusation = typeof patch?.yourAccusation === 'string' ? patch.yourAccusation : null;
  const solution = typeof patch?.solutionSuspectId === 'string' ? patch.solutionSuspectId : null;
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 300000;
  const isInvestigate = phase === 'investigate';
  const isReveal = phase === 'reveal';

  function accuse(suspectId: string): void {
    if (!isInvestigate) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'window-closed' }, { component: 'InvestigationFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ACCUSE, suspectId }, { component: 'InvestigationFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ACCUSE, suspectId });
  }

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined && isInvestigate ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      <Card size="lg" className="flex flex-col gap-2 py-6">
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">The case</span>
        <p className="font-serif text-[24px] font-semibold text-ink">{title}</p>
        <p className="font-sans text-[15px] leading-[1.6] text-ink-2">{brief}</p>
      </Card>

      {evidence.length > 0 ? (
        <Card size="lg" className="flex flex-col gap-3 py-5">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">Evidence</span>
          {evidence.map((e, i) => (
            <div key={typeof e.id === 'string' ? e.id : i} className="rounded-card border border-ink-5 bg-surface px-4 py-3">
              <p className="font-sans text-[14px] font-bold text-ink">{typeof e.label === 'string' ? e.label : ''}</p>
              <p className="font-sans text-[14px] text-ink-3">{typeof e.detail === 'string' ? e.detail : ''}</p>
            </div>
          ))}
        </Card>
      ) : null}

      {timeline.length > 0 ? (
        <Card size="lg" className="flex flex-col gap-2 py-5">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">Timeline</span>
          <ol className="flex flex-col gap-1.5">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-2 font-sans text-[14px] text-ink-2">
                <span className="font-bold text-ink-4">{i + 1}.</span>
                {t}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card size="lg" className="flex flex-col gap-3 py-5">
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">
          {isReveal ? 'The culprit' : interactive ? 'Name your suspect' : 'Suspects'}
        </span>
        {suspects.map((s, i) => {
          const id = typeof s.id === 'string' ? s.id : '';
          const accused = id === yourAccusation;
          const guilty = isReveal && id === solution;
          const tone = guilty
            ? 'border-danger bg-danger-soft'
            : accused
              ? 'border-action bg-action-soft'
              : 'border-ink-5 bg-surface hover:border-action hover:bg-canvas';
          return (
            <button
              key={id || i}
              type="button"
              disabled={!interactive || !isInvestigate}
              onClick={() => accuse(id)}
              className={`rounded-card border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <p className="font-sans text-[15px] font-bold text-ink">
                {guilty ? '🔪 ' : accused ? '👉 ' : ''}
                {typeof s.name === 'string' ? s.name : ''}
              </p>
              <p className="font-sans text-[13px] text-ink-3">{typeof s.profile === 'string' ? s.profile : ''}</p>
            </button>
          );
        })}
      </Card>

      {isReveal ? <StandingsCard patch={patch} nameOf={nameOf} /> : null}
    </div>
  );
}

function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">Case closed</h2>
      <StandingsCard patch={patch} nameOf={nameOf} title="Final scores" />
    </Card>
  );
}
