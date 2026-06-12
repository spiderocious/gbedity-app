import { Button, Card, Pill, SoundKey, useSound } from '@gbedity/ui';

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

// Who Wants to Be a Millionaire animated flow — rotational MCQ ladder with lifelines (50/50,
// ask-the-audience nested poll, phone-a-friend). Backend phases: question / audience_poll /
// phone_wait / reveal / done.

const DONE = ['done'] as const;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const ANSWER = 'millionaire.answer';
const LIFELINE = 'millionaire.lifeline';
const AUDIENCE_VOTE = 'millionaire.audience_vote';
const PHONE_SUGGEST = 'millionaire.phone_suggest';

export function MillionaireFlow({ patch, send, audience, code }: GameFlowProps) {
  useLogMount('MillionaireFlow', { audience });
  const { phase, advance } = useIntroGate(patch, DONE);
  useFlowDebug('MillionaireFlow', patch, { gatePhase: phase, audience, backendPhase: patch?.phase, holderId: patch?.holderId, yourTurn: patch?.yourTurn, rung: patch?.rung, canVoteAudience: patch?.canVoteAudience, youArePhoned: patch?.youArePhoned });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'millionaire');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  return (
    <StageTransition stageKey={phase}>
      {phase === IntroPhase.INTRO ? (
        <IntroStage title={game?.title ?? 'Millionaire'} description={game?.description} onDone={advance} onMount={() => play(SoundKey.GAME_START)} />
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
  const prompt = typeof patch?.prompt === 'string' ? patch.prompt : '';
  const options = Array.isArray(patch?.options) ? (patch.options as string[]) : [];
  const hidden = Array.isArray(patch?.hiddenOptions) ? (patch.hiddenOptions as number[]) : [];
  const answerIdx = typeof patch?.answerIdx === 'number' ? patch.answerIdx : null;
  const rung = typeof patch?.rung === 'number' ? patch.rung : null;
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.phaseSeconds === 'number' ? patch.phaseSeconds * 1000 : 30000;
  const lifelinesUsed = Array.isArray(patch?.lifelinesUsed) ? (patch.lifelinesUsed as string[]) : [];
  const audienceTally = Array.isArray(patch?.audienceTally) ? (patch.audienceTally as number[]) : null;
  const canVoteAudience = patch?.canVoteAudience === true;
  const youArePhoned = patch?.youArePhoned === true;
  const phoneSuggestion = typeof patch?.phoneSuggestion === 'number' ? patch.phoneSuggestion : null;

  const isQuestion = phase === 'question';
  const isReveal = phase === 'reveal';
  const isPoll = phase === 'audience_poll';
  const isPhone = phase === 'phone_wait';

  function answer(i: number): void {
    if (!yourTurn || !isQuestion || hidden.includes(i)) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'cannot-answer', choiceIdx: i }, { component: 'MillionaireFlow' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: ANSWER, choiceIdx: i }, { component: 'MillionaireFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: ANSWER, choiceIdx: i });
  }
  function lifeline(name: string): void {
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: LIFELINE, lifeline: name }, { component: 'MillionaireFlow' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: LIFELINE, lifeline: name });
  }
  function audienceVote(i: number): void {
    play(SoundKey.BUTTON_CLICK);
    send({ type: AUDIENCE_VOTE, choiceIdx: i });
  }
  function phoneSuggest(i: number): void {
    play(SoundKey.BUTTON_CLICK);
    send({ type: PHONE_SUGGEST, choiceIdx: i });
  }

  return (
    <div className="flex flex-col gap-4">
      {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}

      <div className="flex items-center justify-between">
        <TurnSpotlightInline name={holderId ? nameOf(holderId) : '…'} you={yourTurn} />
        {rung !== null ? <Pill tone="action">£{rung.toLocaleString()}</Pill> : null}
      </div>

      {prompt !== '' ? (
        <Card size="lg" className="flex flex-col gap-5 py-6">
          <h2 className="text-center font-serif text-[22px] font-semibold leading-[1.2] text-ink">{prompt}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((text, i) => {
              if (hidden.includes(i)) {
                return <div key={i} className="rounded-card border-2 border-dashed border-ink-5 px-4 py-3 opacity-40" aria-hidden />;
              }
              const correct = isReveal && answerIdx === i;
              const tone = correct ? 'border-action bg-action-soft text-ink' : 'border-ink-5 bg-surface text-ink hover:bg-canvas';
              const pollPct = isPoll && audienceTally ? audienceTally[i] ?? 0 : null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!yourTurn || !isQuestion}
                  onClick={() => answer(i)}
                  className={`flex items-center gap-3 rounded-card border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
                >
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-canvas font-sans text-[14px] font-extrabold text-ink">
                    {LETTERS[i] ?? '•'}
                  </span>
                  <span className="flex-1 font-sans text-[15px] font-semibold">{text}</span>
                  {pollPct !== null ? <span className="font-sans text-[13px] font-bold text-action-deep">{pollPct}</span> : null}
                </button>
              );
            })}
          </div>

          {phoneSuggestion !== null && yourTurn ? (
            <p className="text-center font-sans text-[14px] text-ink-3">
              📞 Your friend suggests <span className="font-bold text-action-deep">{LETTERS[phoneSuggestion]}</span>
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Lifelines — only the holder, during their question, only the unused ones. */}
      {yourTurn && isQuestion ? (
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { key: 'fifty_fifty', label: '50 : 50' },
            { key: 'ask_audience', label: 'Ask the audience' },
            { key: 'phone_friend', label: 'Phone a friend' },
          ].map((l) => (
            <Button key={l.key} variant="ghost" size="sm" disabled={lifelinesUsed.includes(l.key)} onClick={() => lifeline(l.key)}>
              {l.label}
            </Button>
          ))}
        </div>
      ) : null}

      {/* Audience poll — non-holders vote. */}
      {isPoll && canVoteAudience ? (
        <Card size="lg" className="flex flex-col gap-2 py-5">
          <span className="text-center font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-ink-4">Help them out — vote</span>
          <div className="grid grid-cols-4 gap-2">
            {options.map((_, i) => (
              <Button key={i} variant="secondary" size="md" onClick={() => audienceVote(i)}>
                {LETTERS[i]}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Phone a friend — the chosen friend suggests an answer. */}
      {isPhone && youArePhoned ? (
        <Card size="lg" className="flex flex-col gap-2 py-5">
          <span className="text-center font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-ink-4">📞 You’re phoned — suggest an answer</span>
          <div className="grid grid-cols-4 gap-2">
            {options.map((_, i) => (
              <Button key={i} variant="secondary" size="md" onClick={() => phoneSuggest(i)}>
                {LETTERS[i]}
              </Button>
            ))}
          </div>
        </Card>
      ) : isPhone ? (
        <p className="text-center font-sans text-[14px] text-ink-3">Phoning a friend…</p>
      ) : null}

      <StandingsCard patch={patch} nameOf={nameOf} title="Winnings" />
    </div>
  );
}

// Inline spotlight (smaller, sits in the header row next to the rung pill).
function TurnSpotlightInline({ name, you }: { readonly name: string; readonly you: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-ink-4">{you ? 'Your question' : 'In the chair'}</span>
      <span className="font-serif text-[18px] font-semibold text-ink">{you ? 'You' : name}</span>
    </div>
  );
}

function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">That’s a wrap</h2>
      <StandingsCard patch={patch} nameOf={nameOf} title="Final winnings" />
    </Card>
  );
}
