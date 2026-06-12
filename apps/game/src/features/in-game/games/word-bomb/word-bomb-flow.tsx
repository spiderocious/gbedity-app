import { useEffect, useRef, useState } from 'react';

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

// Word Bomb animated flow — round-robin, a decaying bomb passes player to player. The holder must
// type a word in the category before the timer blows. Backend phases: holding / await_validation /
// between / done.

const DONE = ['done'] as const;
const ACTION = 'word_bomb.submit';

export function WordBombFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('WordBombFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('WordBombFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, holderId: patch?.holderId, yourTurn: patch?.yourTurn });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'word_bomb');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Word Bomb'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phase = typeof patch?.phase === 'string' ? patch.phase : '';
  const holderId = typeof patch?.holderId === 'string' ? patch.holderId : null;
  const yourTurn = patch?.yourTurn === true;
  const category = typeof patch?.category === 'string' ? patch.category : '';
  const used = Array.isArray(patch?.used) ? (patch.used as string[]) : [];
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 7000;
  const holding = phase === 'holding';
  const validating = phase === 'await_validation';

  useEffect(() => {
    if (yourTurn && holding) inputRef.current?.focus();
  }, [yourTurn, holding, holderId]);

  function submit(): void {
    const value = text.trim();
    if (value === '' || !yourTurn) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: value === '' ? 'empty' : 'not-your-turn' }, { component: 'WordBombFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ACTION, text: value }, { component: 'WordBombFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ACTION, text: value });
    setText('');
  }

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined && holding ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      <Card size="lg" className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="text-[40px]" aria-hidden>
          💣
        </span>
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">Category</span>
        <p className="font-serif text-[24px] font-semibold text-ink">{category}</p>
      </Card>

      <TurnSpotlight
        name={holderId ? nameOf(holderId) : '…'}
        you={yourTurn}
        subtitle={validating ? 'Checking the word…' : yourTurn ? 'Type a word before it blows!' : 'Holding the bomb'}
      />

      {yourTurn && holding ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={`A ${category.toLowerCase()}…`}
            autoComplete="off"
            autoFocus
            className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[18px] text-ink focus:border-action focus:outline-none"
          />
          <Button variant="primary" size="lg" onClick={submit}>
            Pass it on
          </Button>
        </div>
      ) : null}

      {used.length > 0 ? (
        <Card size="lg" className="py-4">
          <span className="mb-2 block text-center font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-ink-4">Already used</span>
          <div className="flex flex-wrap justify-center gap-2">
            {used.map((w, i) => (
              <span key={`${w}-${i}`} className="rounded-full bg-canvas px-3 py-1 font-sans text-[13px] text-ink-3">
                {w}
              </span>
            ))}
          </div>
        </Card>
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
