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
  LetterSlots,
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

// Spelling Fast animated flow — the word is SPOKEN on the display (client TTS) and NEVER shown to
// players; players hear it (on the shared screen) and race to type the spelling. Secrecy: `speak`
// reaches only the display audience; players get only a length cue. Phases: round / reveal / done.

const CONFIG = { playingPhases: ['round'], revealPhases: ['reveal'], donePhases: ['done'], roundKey: 'idx' } as const;
const ACTION = 'spelling_fast.spell';

// Speak a word via the browser's SpeechSynthesis. No-op when unavailable (SSR / unsupported).
function speak(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    // best-effort; TTS failures are non-fatal
  }
}

export function SpellingFastFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('SpellingFastFlow', { audience });
  const { stage, roundIndex, advance } = useGameFlow(patch, CONFIG);
  useFlowDebug('SpellingFastFlow', patch, { stage, roundIndex, audience, phase: patch?.phase, length: patch?.length, solved: patch?.solved, hasSpeak: typeof patch?.speak === 'string' });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'spelling_fast');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;
  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;

  return (
    <StageTransition stageKey={stage}>
      {stage === FlowStage.INTRO ? (
        <IntroStage title={game?.title ?? 'Spelling Fast'} description={game?.description} rounds={rounds} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
      ) : stage === FlowStage.COUNTDOWN ? (
        <CountdownStage onDone={advance} onTick={() => play(SoundKey.COUNTDOWN_TICK)} />
      ) : stage === FlowStage.ROUND_START ? (
        <GoTransition eyebrow={`Word ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`} headline="LISTEN!" />
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
      {rounds !== undefined ? <p className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-4">{rounds} words</p> : null}
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
  const word = typeof patch?.speak === 'string' ? patch.speak : ''; // display-audience only
  const length = typeof patch?.length === 'number' ? patch.length : 0;
  const solved = patch?.solved === true;
  const interactive = audience !== 'spectator';
  const isDisplay = audience === 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 20000;

  // The display speaks the word once per round (and on demand via the replay button).
  useEffect(() => {
    if (isDisplay && word !== '') speak(word);
  }, [roundIndex, isDisplay, word]);

  useEffect(() => {
    setText('');
  }, [roundIndex]);
  useEffect(() => {
    if (interactive && !solved) inputRef.current?.focus();
  }, [roundIndex, interactive, solved]);

  function submit(): void {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty' }, { component: 'SpellingFastFlow.PlayingStage' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ACTION, len: value.length }, { component: 'SpellingFastFlow.PlayingStage' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ACTION, text: value });
    setText('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Word {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      {isDisplay ? (
        // The shared screen: speak it, show a replay button + masked length (never the letters).
        <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="text-[56px]" aria-hidden>
            🔊
          </span>
          <p className="font-sans text-[14px] text-ink-3">Listen and spell it on your phone</p>
          <Button variant="secondary" size="md" onClick={() => speak(word)}>
            Hear it again
          </Button>
          <LetterSlots masked={'·'.repeat(Math.max(length, word.length || 0))} size="lg" />
        </Card>
      ) : (
        <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="text-[44px]" aria-hidden>
            🎧
          </span>
          <p className="font-sans text-[14px] text-ink-3">
            Spell the word you hear{length > 0 ? ` (${length} letters)` : ''}
          </p>
          {solved ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-action-soft px-4 py-2 font-sans text-[15px] font-bold text-action-deep">Spelled ✓</span>
          ) : (
            <div className="mx-auto flex w-full max-w-md flex-col gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="Type the spelling…"
                autoComplete="off"
                autoFocus
                className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[20px] tracking-wide text-ink focus:border-action focus:outline-none"
              />
              <Button variant="primary" size="lg" onClick={submit}>
                Submit
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function RevealStage({ patch, onMount }: { readonly patch: ViewPatch | null; readonly onMount: () => void }) {
  useOnMount(onMount);
  const answer = typeof patch?.answer === 'string' ? patch.answer : '';
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-ink-3">The word was</p>
      <p className="font-serif text-[40px] font-semibold tracking-[0.04em] text-ink">{answer || '—'}</p>
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
