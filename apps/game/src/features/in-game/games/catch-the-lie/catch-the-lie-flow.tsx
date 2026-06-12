import { useRef, useState } from 'react';

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

// Catch the Lie animated flow — each player submits 2 truths + 1 lie; then each player's three
// statements are revealed anonymously and others vote which is the lie. Phases: submission / reveal / done.

const DONE = ['done'] as const;
const SUBMIT = 'catch_the_lie.submit';
const VOTE = 'catch_the_lie.vote';

export function CatchTheLieFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('CatchTheLieFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('CatchTheLieFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, submitted: patch?.submitted, voted: patch?.voted, isYou: patch?.isYou, revealIdx: patch?.revealIdx });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'catch_the_lie');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Catch the Lie'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const interactive = audience !== 'spectator';
  const submitted = patch?.submitted === true;
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 120000;
  const isSubmission = phase === 'submission';
  const isReveal = phase === 'reveal';

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      {isSubmission ? (
        <SubmissionStage interactive={interactive} submitted={submitted} send={send} play={play} />
      ) : null}

      {isReveal ? <RevealStage patch={patch} interactive={interactive} send={send} play={play} /> : null}

      <StandingsCard patch={patch} nameOf={nameOf} />
    </div>
  );
}

function SubmissionStage({
  interactive,
  submitted,
  send,
  play,
}: {
  readonly interactive: boolean;
  readonly submitted: boolean;
  readonly send: (a: Record<string, unknown>) => void;
  readonly play: (k: SoundKey) => void;
}) {
  const [statements, setStatements] = useState(['', '', '']);
  const [lieIdx, setLieIdx] = useState(0);
  const set = (i: number, v: string): void => setStatements((s) => s.map((x, j) => (j === i ? v : x)));

  function submit(): void {
    const trimmed = statements.map((s) => s.trim());
    if (trimmed.some((s) => s === '')) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'incomplete' }, { component: 'CatchTheLieFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: SUBMIT, lieIdx }, { component: 'CatchTheLieFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: SUBMIT, statements: trimmed, lieIdx });
  }

  if (!interactive) {
    return (
      <Card size="lg" className="py-8 text-center">
        <p className="font-sans text-[14px] text-ink-3">Players are writing two truths and a lie…</p>
      </Card>
    );
  }
  if (submitted) {
    return (
      <Card size="lg" className="py-8 text-center">
        <p className="font-sans text-[15px] font-bold text-action-deep">Submitted ✓ — waiting on the room</p>
      </Card>
    );
  }

  return (
    <Card size="lg" className="flex flex-col gap-4 py-6">
      <p className="text-center font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-ink-4">Two truths and a lie</p>
      {statements.map((s, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[13px] font-semibold text-ink-3">Statement {i + 1}</span>
            <label className="flex items-center gap-1.5 font-sans text-[12px] text-ink-4">
              <input type="radio" name="lie" checked={lieIdx === i} onChange={() => setLieIdx(i)} className="accent-danger" />
              This is the lie
            </label>
          </div>
          <input
            value={s}
            onChange={(e) => set(i, e.target.value)}
            placeholder={`Something ${lieIdx === i ? 'false' : 'true'} about you…`}
            autoComplete="off"
            className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] text-ink focus:border-action focus:outline-none"
          />
        </div>
      ))}
      <Button variant="primary" size="lg" onClick={submit}>
        Submit
      </Button>
    </Card>
  );
}

function RevealStage({
  patch,
  interactive,
  send,
  play,
}: {
  readonly patch: ViewPatch | null;
  readonly interactive: boolean;
  readonly send: (a: Record<string, unknown>) => void;
  readonly play: (k: SoundKey) => void;
}) {
  const statements = Array.isArray(patch?.statements) ? (patch.statements as string[]) : [];
  const isYou = patch?.isYou === true;
  const voted = patch?.voted === true;
  const revealIdx = typeof patch?.revealIdx === 'number' ? patch.revealIdx : 0;
  const total = typeof patch?.totalSubjects === 'number' ? patch.totalSubjects : undefined;
  const votedRef = useRef(false);
  votedRef.current = voted;

  function vote(i: number): void {
    if (isYou || voted) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: isYou ? 'own-subject' : 'already-voted' }, { component: 'CatchTheLieFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: VOTE, statementIdx: i }, { component: 'CatchTheLieFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: VOTE, statementIdx: i });
  }

  return (
    <Card size="lg" className="flex flex-col gap-3 py-6">
      <span className="text-center font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">
        Spot the lie {total !== undefined ? `· ${revealIdx + 1} of ${total}` : ''}
      </span>
      {statements.map((s, i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive || isYou || voted}
          onClick={() => vote(i)}
          className="rounded-card border-2 border-ink-5 bg-surface px-4 py-3 text-left font-sans text-[15px] text-ink transition-colors hover:border-danger hover:bg-canvas disabled:cursor-default disabled:hover:border-ink-5"
        >
          {s}
        </button>
      ))}
      {isYou ? (
        <p className="text-center font-sans text-[14px] text-ink-3">These are yours — sit tight while the room guesses.</p>
      ) : voted ? (
        <p className="text-center font-sans text-[15px] font-bold text-action-deep">Guess locked in ✓</p>
      ) : null}
    </Card>
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
