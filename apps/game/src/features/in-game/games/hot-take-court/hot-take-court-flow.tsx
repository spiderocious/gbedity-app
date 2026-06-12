import { useEffect, useRef, useState } from 'react';

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

// Hot Take Court animated flow — submit a one-line defence to a prompt, then vote anonymously for the
// most convincing. Backend phases: submission / voting / reveal / done (roundIndex per round).

const DONE = ['done'] as const;
const SUBMIT = 'hot_take.submit';
const VOTE = 'hot_take.vote';

export function HotTakeCourtFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('HotTakeCourtFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('HotTakeCourtFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, submitted: patch?.submitted, voted: patch?.voted, ownDefenceId: patch?.ownDefenceId });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'hot_take_court');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Hot Take Court'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const inputRef = useRef<HTMLInputElement>(null);
  const phase = typeof patch?.phase === 'string' ? patch.phase : '';
  const prompt = typeof patch?.prompt === 'string' ? patch.prompt : '';
  const defences = Array.isArray(patch?.defences) ? patch.defences : [];
  const tally = Array.isArray(patch?.tally) ? patch.tally : [];
  const ownId = typeof patch?.ownDefenceId === 'string' ? patch.ownDefenceId : null;
  const submitted = patch?.submitted === true;
  const voted = patch?.voted === true;
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 60000;
  const roundIndex = typeof patch?.roundIndex === 'number' ? patch.roundIndex : 0;
  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;
  const isSubmission = phase === 'submission';
  const isVoting = phase === 'voting';
  const isReveal = phase === 'reveal';

  useEffect(() => {
    setText('');
  }, [roundIndex]);
  useEffect(() => {
    if (interactive && isSubmission && !submitted) inputRef.current?.focus();
  }, [interactive, isSubmission, submitted]);

  function submit(): void {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty' }, { component: 'HotTakeCourtFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: SUBMIT, len: value.length }, { component: 'HotTakeCourtFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: SUBMIT, text: value });
    setText('');
  }
  function vote(defenceId: string): void {
    if (defenceId === ownId) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'own-defence' }, { component: 'HotTakeCourtFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: VOTE, defenceId }, { component: 'HotTakeCourtFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: VOTE, defenceId });
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

      <Card size="lg" className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">The case</span>
        <p className="font-serif text-[22px] font-semibold leading-[1.3] text-ink">{prompt}</p>
      </Card>

      {isSubmission ? (
        interactive ? (
          submitted ? (
            <p className="text-center font-sans text-[15px] font-bold text-action-deep">Defence filed ✓</p>
          ) : (
            <div className="mx-auto flex w-full max-w-md flex-col gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="Your one-line defence…"
                autoComplete="off"
                autoFocus
                className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[16px] text-ink focus:border-action focus:outline-none"
              />
              <Button variant="primary" size="lg" onClick={submit}>
                File defence
              </Button>
            </div>
          )
        ) : (
          <p className="text-center font-sans text-[14px] text-ink-3">Players are writing their defences…</p>
        )
      ) : null}

      {isVoting ? (
        <Card size="lg" className="flex flex-col gap-3 py-5">
          <span className="text-center font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">
            {voted ? 'Vote cast ✓ — waiting on the room' : 'Vote for the most convincing'}
          </span>
          {defences.map((d) => {
            const id = typeof d.id === 'string' ? d.id : '';
            const mine = id === ownId;
            return (
              <button
                key={id}
                type="button"
                disabled={!interactive || voted || mine}
                onClick={() => vote(id)}
                className={`rounded-card border-2 px-4 py-3 text-left font-sans text-[15px] transition-colors disabled:cursor-default ${mine ? 'border-ink-5 bg-canvas text-ink-3' : 'border-ink-5 bg-surface text-ink hover:border-action hover:bg-canvas'}`}
              >
                {typeof d.text === 'string' ? d.text : ''}
                {mine ? <span className="ml-2 font-bold text-ink-4">(yours)</span> : null}
              </button>
            );
          })}
        </Card>
      ) : null}

      {isReveal ? (
        <Card size="lg" className="flex flex-col gap-3 py-5">
          <span className="text-center font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">The verdict</span>
          {[...tally].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).map((t, i) => (
            <div key={typeof t.id === 'string' ? t.id : i} className="flex items-center justify-between gap-3 rounded-card border border-ink-5 bg-surface px-4 py-3">
              <span className="font-sans text-[15px] text-ink">{typeof t.text === 'string' ? t.text : ''}</span>
              <span className="flex items-center gap-2">
                {t.author !== undefined && t.author !== null ? <span className="font-sans text-[12px] text-ink-4">{t.author}</span> : null}
                <span className="font-sans text-[14px] font-bold text-action-deep">{t.votes ?? 0}</span>
              </span>
            </div>
          ))}
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
