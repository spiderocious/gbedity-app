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
import { PromptCard, RankedFeed, rankedRows } from '../../flow/race-primitives.tsx';
import { FlowStage, useGameFlow } from '../../flow/use-game-flow.ts';
import { useFlowDebug } from '../../flow/use-flow-debug.ts';
import { useCountdown } from '../../flow/use-countdown.ts';
import { useOnMount, useTimeout } from '../../flow/use-timeout.ts';
import type { GameFlowProps } from '../../flow/flow-registry.tsx';

// The shared "race-by-closeness" animated flow — Scrambled Word, Definition Race, Synonyms/Antonyms.
// Each is: a prompt + a text box; players race to type the answer; a live ranked feed updates; at
// reveal the answer shows. Only the prompt field/label + action type differ → one component + config.
// Backend phases: round / reveal / done (roundKey 'idx').

export interface RaceFlowConfig {
  /** Backend gameId (for the catalogue title join). */
  readonly gameId: string;
  /** Patch field carrying the prompt (e.g. 'scrambled', 'definition', 'prompt'). */
  readonly promptField: 'scrambled' | 'definition' | 'prompt';
  /** Eyebrow above the prompt (e.g. 'Unscramble', 'Define the word', 'Synonym of'). */
  readonly promptLabel: string;
  /** The client.action type to submit a guess. */
  readonly actionType: string;
  /** Render the prompt monospace + spaced (good for scrambled letters). */
  readonly mono?: boolean;
  /** Input placeholder. */
  readonly placeholder: string;
  /** Fallback title if the catalogue hasn't loaded. */
  readonly fallbackTitle: string;
}

const FLOW_CONFIG = {
  playingPhases: ['round'],
  revealPhases: ['reveal'],
  donePhases: ['done'],
  roundKey: 'idx',
} as const;

export function makeRaceFlow(cfg: RaceFlowConfig): (props: GameFlowProps) => React.ReactNode {
  function RaceFlow({ patch, send, audience, code }: GameFlowProps) {
    useLogMount('RaceFlow', { gameId: cfg.gameId, audience });
    const { stage, roundIndex, advance } = useGameFlow(patch, FLOW_CONFIG);
    useFlowDebug(`RaceFlow:${cfg.gameId}`, patch, { stage, roundIndex, audience, phase: patch?.phase, yourClosest: patch?.yourClosest, yourAccepted: patch?.yourAccepted, yourScore: patch?.yourScore });
    const { play } = useSound();
    const { data: catalogue } = useCatalogue();
    const game = findGame(catalogue ?? [], cfg.gameId);
    const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
    const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;
    const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;

    return (
      <StageTransition stageKey={stage}>
        {stage === FlowStage.INTRO ? (
          <IntroStage title={game?.title ?? cfg.fallbackTitle} description={game?.description} rounds={rounds} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
        ) : stage === FlowStage.COUNTDOWN ? (
          <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
        ) : stage === FlowStage.ROUND_START ? (
          <GoTransition eyebrow={`Round ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`} headline="GO!" />
        ) : stage === FlowStage.PLAYING ? (
          <PlayingStage cfg={cfg} patch={patch} send={send} audience={audience} play={play} roundIndex={roundIndex} rounds={rounds} />
        ) : stage === FlowStage.REVEAL ? (
          <RevealStage cfg={cfg} patch={patch} onMount={() => play(SoundKey.ROUND_WIN)} />
        ) : stage === FlowStage.ROUND_SCORES ? (
          <ScoresStage patch={patch} nameOf={nameOf} />
        ) : (
          <DoneStage patch={patch} nameOf={nameOf} />
        )}
      </StageTransition>
    );
  }
  return RaceFlow;
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

function promptText(patch: ViewPatch | null, field: RaceFlowConfig['promptField']): string {
  const v = patch ? (patch as Record<string, unknown>)[field] : undefined;
  return typeof v === 'string' ? v : '';
}

function PlayingStage({
  cfg,
  patch,
  send,
  audience,
  play,
  roundIndex,
  rounds,
}: {
  readonly cfg: RaceFlowConfig;
  readonly patch: ViewPatch | null;
  readonly send: (a: Record<string, unknown>) => void;
  readonly audience: GameFlowProps['audience'];
  readonly play: (k: SoundKey) => void;
  readonly roundIndex: number;
  readonly rounds?: number;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = promptText(patch, cfg.promptField);
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 25000;
  const yourClosest = typeof patch?.yourClosest === 'number' ? patch.yourClosest : null;
  const yourAccepted = typeof patch?.yourAccepted === 'number' ? patch.yourAccepted : null;
  const rows = rankedRows(patch);

  useEffect(() => {
    if (interactive && prompt !== '') inputRef.current?.focus();
  }, [roundIndex, interactive, prompt]);

  function submit(): void {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty', gameId: cfg.gameId }, { component: 'RaceFlow.PlayingStage' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: cfg.actionType, text: value, gameId: cfg.gameId }, { component: 'RaceFlow.PlayingStage' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: cfg.actionType, text: value });
    setText('');
  }

  if (prompt === '') {
    return (
      <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">Loading…</span>
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

      <PromptCard eyebrow={cfg.promptLabel} prompt={prompt} mono={cfg.mono ?? false} />

      {interactive ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={cfg.placeholder}
            autoComplete="off"
            autoFocus
            className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[18px] text-ink focus:border-action focus:outline-none"
          />
          <Button variant="primary" size="lg" onClick={submit}>
            Submit
          </Button>
          {yourClosest !== null ? (
            <p className="text-center font-sans text-[13px] text-ink-3">
              Your closest: <span className="font-bold text-action-deep">{yourClosest}%</span>
            </p>
          ) : null}
          {yourAccepted !== null ? (
            <p className="text-center font-sans text-[13px] text-ink-3">
              Accepted: <span className="font-bold text-action-deep">{yourAccepted}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-center font-sans text-[14px] text-ink-3">Players are racing…</p>
      )}

      <Card size="lg" className="py-5">
        <span className="mb-3 block text-center font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-4">Live leaders</span>
        <RankedFeed rows={rows} />
      </Card>
    </div>
  );
}

function RevealStage({ cfg, patch, onMount }: { readonly cfg: RaceFlowConfig; readonly patch: ViewPatch | null; readonly onMount: () => void }) {
  useOnMount(onMount);
  const answer = typeof patch?.answer === 'string' ? patch.answer : '';
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-ink-3">The answer was</p>
      <p className="font-serif text-[40px] font-semibold tracking-[0.02em] text-ink">{answer || '—'}</p>
      <span className="font-sans text-[12px] text-ink-4">{cfg.promptLabel}</span>
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
