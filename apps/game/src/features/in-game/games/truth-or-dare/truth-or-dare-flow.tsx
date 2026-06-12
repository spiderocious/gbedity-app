import { Button, Card, SoundKey, useSound } from '@gbedity/ui';

import { findGame, useCatalogue } from '../../../../shared/catalogue/index.ts';
import { useLobby } from '../../../../shared/api/use-lobby.ts';
import { log, useLogMount } from '../../../../shared/observability/logger.ts';
import { LogEvent } from '../../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../../shared/types/view.ts';
import { StageTransition, TimerBar } from '../../flow/flow-primitives.tsx';
import { CountdownStage, IntroStage } from '../../flow/intro-stages.tsx';
import { StandingsCard, TurnSpotlight } from '../../flow/turn-primitives.tsx';
import { IntroPhase, useIntroGate } from '../../flow/use-intro-gate.ts';
import { useFlowDebug } from '../../flow/use-flow-debug.ts';
import type { GameFlowProps } from '../../flow/flow-registry.tsx';

// Truth or Dare animated flow — round-robin. The active player picks Truth or Dare; a prompt shows;
// everyone else votes whether they completed it. Backend phases: choose / vote / done.

const DONE = ['done'] as const;
const CHOOSE = 'truth_or_dare.choose';
const VOTE = 'truth_or_dare.vote';

export function TruthOrDareFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('TruthOrDareFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('TruthOrDareFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, holderId: patch?.holderId, yourTurn: patch?.yourTurn, canVote: patch?.canVote, voted: patch?.voted, choice: patch?.choice });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'truth_or_dare');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Truth or Dare'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : phase === IntroPhase.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : phase === IntroPhase.DONE ? (
        <DoneStage patch={patch} nameOf={nameOf} />
      ) : (
        <LiveBody patch={patch} send={send} play={play} nameOf={nameOf} />
      )}
    </StageTransition>
  );
}

function LiveBody({
  patch,
  send,
  play,
  nameOf,
}: {
  readonly patch: ViewPatch | null;
  readonly send: (a: Record<string, unknown>) => void;
  readonly play: (k: SoundKey) => void;
  readonly nameOf: (id: string) => string;
}) {
  const phase = typeof patch?.phase === 'string' ? patch.phase : '';
  const holderId = typeof patch?.holderId === 'string' ? patch.holderId : null;
  const yourTurn = patch?.yourTurn === true;
  const canVote = patch?.canVote === true;
  const voted = patch?.voted === true;
  const choice = typeof patch?.choice === 'string' ? patch.choice : null;
  const prompt = typeof patch?.prompt === 'string' ? patch.prompt : '';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 20000;
  const choosing = phase === 'choose';

  function choose(c: 'truth' | 'dare'): void {
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: CHOOSE, choice: c }, { component: 'TruthOrDareFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: CHOOSE, choice: c });
  }
  function vote(completed: boolean): void {
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: VOTE, completed }, { component: 'TruthOrDareFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: VOTE, completed });
  }

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      <TurnSpotlight
        name={holderId ? nameOf(holderId) : '…'}
        you={yourTurn}
        accent={choice !== null ? choice.toUpperCase() : undefined}
        subtitle={choosing ? (yourTurn ? 'Pick your poison' : 'Choosing Truth or Dare…') : undefined}
      />

      {choosing && yourTurn ? (
        <div className="mx-auto flex w-full max-w-md gap-3">
          <Button variant="primary" size="lg" className="flex-1" onClick={() => choose('truth')}>
            Truth
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => choose('dare')}>
            Dare
          </Button>
        </div>
      ) : null}

      {phase === 'vote' && prompt !== '' ? (
        <Card size="lg" className="flex flex-col items-center gap-3 py-7 text-center">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">{choice === 'dare' ? 'The dare' : 'The truth'}</span>
          <p className="font-serif text-[22px] font-semibold leading-[1.3] text-ink">{prompt}</p>
        </Card>
      ) : null}

      {phase === 'vote' && canVote ? (
        voted ? (
          <p className="text-center font-sans text-[15px] font-bold text-action-deep">Vote cast ✓</p>
        ) : (
          <div className="mx-auto flex w-full max-w-md gap-3">
            <Button variant="primary" size="lg" className="flex-1" onClick={() => vote(true)}>
              They did it ✓
            </Button>
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => vote(false)}>
              Nope ✗
            </Button>
          </div>
        )
      ) : phase === 'vote' && yourTurn ? (
        <p className="text-center font-sans text-[14px] text-ink-3">The room is voting on you…</p>
      ) : null}

      <StandingsCard patch={patch} nameOf={nameOf} />
    </div>
  );
}

function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">That’s a wrap</h2>
      <StandingsCard patch={patch} nameOf={nameOf} title="Final scores" />
    </Card>
  );
}
