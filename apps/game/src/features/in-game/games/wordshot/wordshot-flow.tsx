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
import { RankedFeed, rankedRows } from '../../flow/race-primitives.tsx';
import { FlowStage, useGameFlow } from '../../flow/use-game-flow.ts';
import { useFlowDebug } from '../../flow/use-flow-debug.ts';
import { useCountdown } from '../../flow/use-countdown.ts';
import { useOnMount, useTimeout } from '../../flow/use-timeout.ts';
import type { GameFlowProps } from '../../flow/flow-registry.tsx';

// Wordshot animated flow — simultaneous letter+category sprint. A letter + category prompt; each
// player submits ONE word; the validation service scores it; a live ranked feed shows the top words
// by points. Backend phases: round / reveal / done (roundKey 'roundIndex').

const CONFIG = {
  playingPhases: ['round'],
  revealPhases: ['reveal'],
  donePhases: ['done'],
  roundKey: 'roundIndex',
} as const;

const ACTION = 'wordshot.submit';

export function WordshotFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('WordshotFlow', { audience });
  const { stage, roundIndex, advance } = useGameFlow(patch, CONFIG);
  useFlowDebug('WordshotFlow', patch, { stage, roundIndex, audience, phase: patch?.phase, letter: patch?.letter, category: patch?.category, yourScore: patch?.yourScore });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'wordshot');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;
  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;

  return (
    <StageTransition stageKey={stage}>
      {stage === FlowStage.INTRO ? (
        <IntroStage title={game?.title ?? 'Wordshot'} description={game?.description} rounds={rounds} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : stage === FlowStage.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : stage === FlowStage.ROUND_START ? (
        <GoTransition eyebrow={`Round ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`} headline="GO!" />
      ) : stage === FlowStage.PLAYING ? (
        <PlayingStage patch={patch} send={send} audience={audience} play={play} roundIndex={roundIndex} rounds={rounds} />
      ) : stage === FlowStage.REVEAL ? (
        <RevealStage patch={patch} onMount={() => play(SoundKey.ROUND_WIN)} />
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
      {rounds !== undefined ? <p className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-4">{rounds} rounds</p> : null}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const letter = typeof patch?.letter === 'string' ? patch.letter : '';
  const category = typeof patch?.category === 'string' ? patch.category : '';
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 20000;
  const own = patch?.yourSubmission;
  const submitted = own !== null && own !== undefined && typeof own === 'object';
  const rows = rankedRows(patch);

  useEffect(() => {
    if (interactive && !submitted && letter !== '') inputRef.current?.focus();
  }, [roundIndex, interactive, submitted, letter]);

  function submit(): void {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty' }, { component: 'WordshotFlow.PlayingStage' });
      return;
    }
    if (submitted) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'already-submitted' }, { component: 'WordshotFlow.PlayingStage' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ACTION, text: value }, { component: 'WordshotFlow.PlayingStage' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ACTION, text: value });
    setText('');
  }

  if (letter === '') {
    return (
      <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">Loading the round…</span>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Round {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      <Card size="lg" className="flex flex-col items-center gap-3 py-7 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-card-lg bg-action-soft">
          <span className="font-serif text-[44px] font-bold text-action-deep">{letter.toUpperCase()}</span>
        </div>
        <p className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-ink-4">Category</p>
        <p className="font-serif text-[24px] font-semibold text-ink">{category}</p>
      </Card>

      {interactive ? (
        submitted ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-action-soft px-4 py-2 font-sans text-[15px] font-bold text-action-deep">Submitted ✓</span>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={`A ${category.toLowerCase()} starting with ${letter.toUpperCase()}…`}
              autoComplete="off"
              autoFocus
              className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[18px] text-ink focus:border-action focus:outline-none"
            />
            <Button variant="primary" size="lg" onClick={submit}>
              Submit
            </Button>
          </div>
        )
      ) : (
        <p className="text-center font-sans text-[14px] text-ink-3">Players are racing…</p>
      )}

      <Card size="lg" className="py-5">
        <span className="mb-3 block text-center font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-4">Live leaders</span>
        <RankedFeed rows={rows} unit=" pts" />
      </Card>
    </div>
  );
}

function RevealStage({ patch, onMount }: { readonly patch: ViewPatch | null; readonly onMount: () => void }) {
  useOnMount(onMount);
  const rows = rankedRows(patch);
  return (
    <Card size="lg" className="flex flex-col gap-4 py-8">
      <p className="text-center font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-ink-3">Top words this round</p>
      <RankedFeed rows={rows} unit=" pts" emptyHint="No valid words this round." />
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
