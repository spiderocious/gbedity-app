import { useEffect, useRef, useState } from 'react';

import { Card, Pill, SoundKey, useSound } from '@gbedity/ui';

import { findGame, useCatalogue } from '../../../../shared/catalogue/index.ts';
import { useLobby } from '../../../../shared/api/use-lobby.ts';
import { log, useLogMount } from '../../../../shared/observability/logger.ts';
import { LogEvent } from '../../../../shared/observability/events.ts';
import type { ViewPatch } from '../../../../shared/types/view.ts';
import {
  CountdownNumerals,
  GoTransition,
  RoundScores,
  StageTransition,
  TimerBar,
  type ScoreRow,
} from '../../flow/flow-primitives.tsx';
import { FlowStage, useGameFlow } from '../../flow/use-game-flow.ts';
import { useFlowDebug } from '../../flow/use-flow-debug.ts';
import { useCountdown } from '../../flow/use-countdown.ts';
import { useOnMount, useTimeout } from '../../flow/use-timeout.ts';
import type { GameFlowProps } from '../../flow/flow-registry.tsx';

// Quizzes (and Bible Quiz — same shape) animated flow. MCQ: a prompt + four options; tap to answer;
// at reveal the correct option lights up. Shares the whole flow toolkit; only the "playing" + reveal
// rendering is quiz-specific. Backend phases: question / reveal / done.

const QUIZ_CONFIG = {
  playingPhases: ['question'],
  revealPhases: ['reveal'],
  donePhases: ['done'],
  roundKey: 'qIndex',
} as const;

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuizzesFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('QuizzesFlow', { audience });
  const { stage, roundIndex, advance } = useGameFlow(patch, QUIZ_CONFIG);
  useFlowDebug('QuizzesFlow', patch, { stage, roundIndex, audience, phase: patch?.phase, answered: patch?.answered, yourScore: patch?.yourScore });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'quizzes');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;

  return (
    <StageTransition stageKey={stage}>
      {stage === FlowStage.INTRO ? (
        <IntroStage title={game?.title ?? 'Quizzes'} description={game?.description} rounds={rounds} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : stage === FlowStage.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : stage === FlowStage.ROUND_START ? (
        <GoTransition eyebrow={`Question ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`} headline="GO!" />
      ) : stage === FlowStage.PLAYING || stage === FlowStage.REVEAL ? (
        <QuestionStage patch={patch} send={send} audience={audience} play={play} roundIndex={roundIndex} rounds={rounds} revealing={stage === FlowStage.REVEAL} />
      ) : stage === FlowStage.ROUND_SCORES ? (
        <ScoresStage patch={patch} nameOf={nameOf} onMount={() => play(SoundKey.ROUND_WIN)} />
      ) : (
        <DoneStage patch={patch} nameOf={nameOf} />
      )}
    </StageTransition>
  );
}

function IntroStage({ title, description, rounds, onDone, onMount }: { readonly title: string; readonly description?: string; readonly rounds?: number; readonly onDone: () => void; readonly onMount: () => void }) {
  useOnMount(onMount);
  useTimeout(onDone, 2800);
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-12 text-center">
      <Pill tone="action">Get ready</Pill>
      <h1 className="font-serif text-[clamp(40px,10vw,80px)] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">{title}</h1>
      {description !== undefined ? <p className="max-w-[42ch] font-sans text-[16px] text-ink-3">{description}</p> : null}
      {rounds !== undefined ? <p className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-4">{rounds} questions</p> : null}
    </Card>
  );
}

function CountdownStage({ onDone, onTick }: { readonly onDone: () => void; readonly onTick: () => void }) {
  const count = useCountdown(3, onDone);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== count) {
      last.current = count;
      onTickRef.current();
    }
  }, [count]);
  return (
    <Card size="lg" className="flex flex-col items-center gap-2 py-12">
      <CountdownNumerals value={count} />
    </Card>
  );
}

// QUESTION + REVEAL share this surface (reveal just locks input + colours the correct option).
function QuestionStage({
  patch,
  send,
  audience,
  play,
  roundIndex,
  rounds,
  revealing,
}: {
  readonly patch: ViewPatch | null;
  readonly send: (a: Record<string, unknown>) => void;
  readonly audience: GameFlowProps['audience'];
  readonly play: (k: SoundKey) => void;
  readonly roundIndex: number;
  readonly rounds?: number;
  readonly revealing: boolean;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const prompt = typeof patch?.prompt === 'string' ? patch.prompt : '';
  const options = Array.isArray(patch?.options) ? (patch.options as string[]) : [];
  const answerIdx = typeof patch?.answerIdx === 'number' ? patch.answerIdx : null;
  const answered = patch?.answered === true || chosen !== null;
  const interactive = audience !== 'spectator' && !revealing;
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 20000;

  // Reset the local choice when a new question arrives.
  useEffect(() => {
    setChosen(null);
  }, [roundIndex]);

  function pick(i: number): void {
    if (!interactive || answered) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { interactive, answered, choiceIdx: i }, { component: 'QuizzesFlow' });
      return;
    }
    setChosen(i);
    play(SoundKey.BUTTON_CLICK);
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: 'quizzes.answer', questionIdx: roundIndex, choiceIdx: i }, { component: 'QuizzesFlow' });
    send({ type: 'quizzes.answer', questionIdx: roundIndex, choiceIdx: i });
  }

  if (prompt === '') {
    return (
      <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">Loading the question…</span>
      </Card>
    );
  }

  return (
    <Card size="lg" className="flex flex-col items-stretch gap-6 py-7">
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Question {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined && !revealing ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      <h2 className="text-center font-serif text-[26px] font-semibold leading-[1.15] text-ink">{prompt}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((text, i) => {
          const isCorrect = revealing && answerIdx === i;
          const isWrongChoice = revealing && chosen === i && answerIdx !== i;
          const isChosen = chosen === i;
          const tone = isCorrect
            ? 'border-action bg-action-soft text-ink'
            : isWrongChoice
              ? 'border-danger bg-danger-soft text-ink'
              : isChosen
                ? 'border-action bg-action-soft text-ink'
                : 'border-ink-5 bg-surface text-ink hover:bg-canvas';
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive || answered}
              onClick={() => pick(i)}
              className={`flex items-center gap-3 rounded-card border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-canvas font-sans text-[14px] font-extrabold text-ink">
                {LETTERS[i] ?? '•'}
              </span>
              <span className="font-sans text-[15px] font-semibold">{text}</span>
            </button>
          );
        })}
      </div>

      {audience === 'spectator' ? (
        <p className="text-center font-sans text-[14px] text-ink-3">Players are answering…</p>
      ) : answered && !revealing ? (
        <p className="text-center font-sans text-[15px] font-bold text-action-deep">Answer locked in ✓</p>
      ) : null}
    </Card>
  );
}

function boardRows(patch: ViewPatch | null, nameOf: (id: string) => string): ScoreRow[] {
  return (patch?.board ?? []).map((b) => ({
    ...(b.playerId !== undefined ? { id: b.playerId } : {}),
    name: b.name ?? (b.playerId !== undefined ? nameOf(b.playerId) : '—'),
    points: typeof b.points === 'number' ? b.points : 0,
    roundDelta: typeof b.roundDelta === 'number' ? b.roundDelta : 0,
  }));
}

function ScoresStage({ patch, nameOf, onMount }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string; readonly onMount: () => void }) {
  useOnMount(onMount);
  return (
    <Card size="lg" className="py-6">
      <RoundScores title="Scores" rows={boardRows(patch, nameOf)} />
    </Card>
  );
}

function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">That’s a wrap</h2>
      <RoundScores title="Final scores" rows={boardRows(patch, nameOf)} />
    </Card>
  );
}
