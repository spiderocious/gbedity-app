import { useState } from 'react';

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

// Presentation animated flow — round-robin. Each player presents a topic aloud; others rate across
// three 1–5 criteria. Backend phases: present / rate / done.

const DONE = ['done'] as const;
const RATE = 'presentation.rate';
const CRITERIA = [
  { key: 'persuasiveness', label: 'Persuasiveness' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'confidence', label: 'Confidence' },
] as const;

export function PresentationFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('PresentationFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('PresentationFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, presenterId: patch?.presenterId, youArePresenting: patch?.youArePresenting, canRate: patch?.canRate, rated: patch?.rated });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'presentation');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Presentation'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const presenterId = typeof patch?.presenterId === 'string' ? patch.presenterId : null;
  const youArePresenting = patch?.youArePresenting === true;
  const canRate = patch?.canRate === true;
  const rated = patch?.rated === true;
  const topic = typeof patch?.topic === 'string' ? patch.topic : '';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 90000;
  const presenting = phase === 'present';

  const [ratings, setRatings] = useState<Record<string, number>>({ persuasiveness: 3, entertainment: 3, confidence: 3 });

  function submitRating(): void {
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: RATE, ratings }, { component: 'PresentationFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: RATE, ratings });
  }

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      <Card size="lg" className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ink-4">Topic</span>
        <p className="font-serif text-[24px] font-semibold leading-[1.25] text-ink">{topic}</p>
      </Card>

      <TurnSpotlight
        name={presenterId ? nameOf(presenterId) : '…'}
        you={youArePresenting}
        subtitle={presenting ? (youArePresenting ? 'You’re on — present aloud!' : 'is presenting…') : 'Rate the presentation'}
      />

      {phase === 'rate' && canRate ? (
        rated ? (
          <p className="text-center font-sans text-[15px] font-bold text-action-deep">Rating submitted ✓</p>
        ) : (
          <Card size="lg" className="flex flex-col gap-5 py-6">
            {CRITERIA.map((c) => (
              <div key={c.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[14px] font-bold text-ink">{c.label}</span>
                  <span className="font-sans text-[14px] font-bold tabular-nums text-action-deep">{ratings[c.key]}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={ratings[c.key]}
                  onChange={(e) => setRatings((r) => ({ ...r, [c.key]: Number(e.target.value) }))}
                  className="w-full accent-action"
                />
              </div>
            ))}
            <Button variant="primary" size="lg" onClick={submitRating}>
              Submit rating
            </Button>
          </Card>
        )
      ) : phase === 'rate' && youArePresenting ? (
        <p className="text-center font-sans text-[14px] text-ink-3">The room is rating you…</p>
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
