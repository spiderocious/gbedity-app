import { useEffect, useRef, useState } from 'react';

import { Button, Card, Pill, SoundKey, useSound } from '@gbedity/ui';

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

// Typing Fast animated flow — a passage shows; players type it; score = WPM × accuracy. The player
// submits their typed text (final on done / timeout). Backend phases: round / reveal / done (roundKey 'idx').

const CONFIG = { playingPhases: ['round'], revealPhases: ['reveal'], donePhases: ['done'], roundKey: 'idx' } as const;
const ACTION = 'typing_fast.submit';

export function TypingFastFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('TypingFastFlow', { audience });
  const { stage, roundIndex, advance } = useGameFlow(patch, CONFIG);
  useFlowDebug('TypingFastFlow', patch, { stage, roundIndex, audience, phase: patch?.phase, submitted: patch?.submitted, yourScore: patch?.yourScore });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'typing_fast');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;
  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;

  return (
    <StageTransition stageKey={stage}>
      {stage === FlowStage.INTRO ? (
        <IntroStage title={game?.title ?? 'Typing Fast'} description={game?.description} rounds={rounds} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : stage === FlowStage.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : stage === FlowStage.ROUND_START ? (
        <GoTransition eyebrow={`Passage ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`} headline="TYPE!" />
      ) : stage === FlowStage.PLAYING ? (
        <PlayingStage patch={patch} send={send} audience={audience} play={play} roundIndex={roundIndex} rounds={rounds} />
      ) : stage === FlowStage.REVEAL ? (
        <RevealStage onMount={() => play(SoundKey.ROUND_WIN)} />
      ) : stage === FlowStage.ROUND_SCORES ? (
        <ScoresStage patch={patch} nameOf={nameOf} />
      ) : (
        <DoneStage patch={patch} nameOf={nameOf} />
      )}
    </StageTransition>
  );
}

function IntroStage({ title, description, rounds, onDone, onMount }: { readonly title: string; readonly description?: string; readonly rounds?: number; readonly onDone: () => void; readonly onMount: () => void }) {
  useOnMount(onMount);
  useTimeout(onDone, 2600);
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-12 text-center">
      <Pill tone="action">Get ready</Pill>
      <h1 className="font-serif text-[clamp(40px,10vw,80px)] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">{title}</h1>
      {description !== undefined ? <p className="max-w-[42ch] font-sans text-[16px] text-ink-3">{description}</p> : null}
      {rounds !== undefined ? <p className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-4">{rounds} passages</p> : null}
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

// Char-level accuracy against the target (mirrors the backend) — for live feedback only.
function accuracyOf(typed: string, target: string): number {
  if (target.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < target.length; i += 1) if (typed[i] === target[i]) correct += 1;
  return Math.round((correct / target.length) * 100);
}

function PlayingStage({
  patch,
  send,
  audience,
  play,
  roundIndex,
  rounds,
}: {
  readonly patch: ViewPatch | null;
  readonly send: (a: Record<string, unknown>) => void;
  readonly audience: GameFlowProps['audience'];
  readonly play: (k: SoundKey) => void;
  readonly roundIndex: number;
  readonly rounds?: number;
}) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const passage = typeof patch?.passage === 'string' ? patch.passage : '';
  const interactive = audience !== 'spectator';
  const submitted = patch?.submitted === true;
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 60000;
  const acc = accuracyOf(text, passage);

  useEffect(() => {
    setText('');
  }, [roundIndex]);
  useEffect(() => {
    if (interactive && passage !== '') taRef.current?.focus();
  }, [roundIndex, interactive, passage]);

  // Continuously sync progress so the backend has the latest text on timeout (final wins).
  function pushProgress(next: string): void {
    setText(next);
    if (interactive) send({ type: ACTION, text: next });
  }

  function submit(): void {
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ACTION, len: text.length, accuracy: acc }, { component: 'TypingFastFlow.PlayingStage' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ACTION, text });
  }

  if (passage === '') {
    return (
      <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">Loading the passage…</span>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Passage {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      <Card size="lg" className="py-6">
        <p className="select-none font-serif text-[18px] leading-[1.7] text-ink-2">{passage}</p>
      </Card>

      {interactive ? (
        submitted ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-action-soft px-4 py-2 font-sans text-[15px] font-bold text-action-deep">Submitted ✓</span>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => pushProgress(e.target.value)}
              rows={4}
              placeholder="Start typing the passage…"
              autoComplete="off"
              autoFocus
              className="resize-none rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-mono text-[15px] leading-[1.6] text-ink focus:border-action focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="font-sans text-[13px] text-ink-3">
                Accuracy <span className="font-bold text-action-deep">{acc}%</span>
              </span>
              <Button variant="primary" size="md" onClick={submit}>
                Done
              </Button>
            </div>
          </div>
        )
      ) : (
        <p className="text-center font-sans text-[14px] text-ink-3">Players are typing…</p>
      )}
    </div>
  );
}

function RevealStage({ onMount }: { readonly onMount: () => void }) {
  useOnMount(onMount);
  return (
    <Card size="lg" className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="font-serif text-[22px] font-semibold text-ink">Pencils down ✍️</p>
      <p className="font-sans text-[14px] text-ink-3">Scoring speed and accuracy…</p>
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

function ScoresStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
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
