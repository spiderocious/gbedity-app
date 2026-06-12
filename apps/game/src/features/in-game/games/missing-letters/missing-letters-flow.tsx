import { useEffect, useRef, useState } from 'react';

import { Button, Card, Pill, SoundKey, useSound } from '@gbedity/ui';

import { findGame, useCatalogue } from '../../../../shared/catalogue/index.ts';
import type { ViewPatch } from '../../../../shared/types/view.ts';
import { useLobby } from '../../../../shared/api/use-lobby.ts';
import { sessionStore } from '../../../../shared/services/session-store.ts';
import { log, useLogMount } from '../../../../shared/observability/logger.ts';
import { LogEvent } from '../../../../shared/observability/events.ts';
import {
  CountdownNumerals,
  GoTransition,
  LetterSlots,
  RoundScores,
  StageTransition,
  TimerBar,
  type ScoreRow,
} from '../../flow/flow-primitives.tsx';
import { useCountdown } from '../../flow/use-countdown.ts';
import { useOnMount, useTimeout } from '../../flow/use-timeout.ts';
import { FlowStage, useMissingLettersFlow } from './use-missing-letters-flow.ts';
import { CheckInRow, MetaChips, PreviewTiles, type CheckInPlayer, type MetaChip } from './parts/intro-parts.tsx';
import { RoundPresence, type RoundPlayer } from './parts/round-presence.tsx';

// The Missing Letters animated flow (spec §3.1), shared by all three audiences. `audience` switches
// the rendering (player = interactive input; host = same play surface; spectator/display = read-only
// big). The stage machine + interstitials are identical across audiences.

export type FlowAudience = 'player' | 'host' | 'spectator';

interface MissingLettersFlowProps {
  readonly patch: ViewPatch | null;
  readonly send: (action: Record<string, unknown>) => void;
  readonly audience: FlowAudience;
  readonly code?: string;
}

const GUESS = 'missing_letters.guess';

export function MissingLettersFlow({ patch, send, audience, code }: MissingLettersFlowProps) {
  // Mount/unmount is the canary for the remount bug: a fresh mount resets the stage machine to INTRO.
  useLogMount(`MissingLettersFlow:${audience}`, { code });
  const { stage, roundIndex, advance } = useMissingLettersFlow(patch);
  log.event(LogEvent.FLOW_PATCH_IN, { audience, stage, phase: patch?.phase, idx: patch?.idx, masked: typeof patch?.masked === 'string' ? patch.masked : undefined, solved: patch?.solved }, { component: `MissingLettersFlow:${audience}` });
  const { play } = useSound();
  const { data: catalogue } = useCatalogue();
  const game = findGame(catalogue ?? [], 'missing_letters');
  const lobby = useLobby(code ?? '', code !== undefined && code !== '', false);
  const nameOf = (id: string): string => lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  const rounds = typeof patch?.rounds === 'number' ? patch.rounds : undefined;
  const secondsPerRound = typeof patch?.secondsPerRound === 'number' ? patch.secondsPerRound : undefined;
  const checkIn: CheckInPlayer[] = (lobby.data?.players ?? [])
    .filter((p) => !p.spectator)
    .map((p) => ({ id: p.id, name: p.nickname }));
  const youId = sessionStore.getPlayer()?.playerId;

  return (
    <StageTransition stageKey={stage}>
      {stage === FlowStage.INTRO ? (
        <IntroStage
          title={game?.title ?? 'Missing Letters'}
          description={game?.description}
          rounds={rounds}
          secondsPerRound={secondsPerRound}
          players={checkIn}
          audience={audience}
          onDone={advance}
          onMount={() => play(SoundKey.GAME_START)}
        />
      ) : stage === FlowStage.COUNTDOWN ? (
        <CountdownStage
          deadline={patch?.phase === 'countdown' && typeof patch.deadline === 'number' ? patch.deadline : undefined}
          onDone={advance}
          onTick={() => play(SoundKey.COUNTDOWN_TICK)}
        />
      ) : stage === FlowStage.ROUND_START ? (
        <RoundStartStage roundIndex={roundIndex} rounds={rounds} />
      ) : stage === FlowStage.PLAYING ? (
        <PlayingStage
          patch={patch}
          send={send}
          audience={audience}
          play={play}
          players={checkIn}
          youId={youId}
          roundIndex={roundIndex}
          rounds={rounds}
        />
      ) : stage === FlowStage.REVEAL ? (
        <RevealStage patch={patch} onReveal={() => play(SoundKey.SUCCESS)} />
      ) : stage === FlowStage.ROUND_SCORES ? (
        <RoundScoresStage patch={patch} nameOf={nameOf} onMount={() => play(SoundKey.ROUND_WIN)} />
      ) : (
        <DoneStage patch={patch} nameOf={nameOf} />
      )}
    </StageTransition>
  );
}

// ── Stage: intro ────────────────────────────────────────────────────────────────
// The "Get Ready" anticipation beat: the room is settling in before the countdown. The game name is
// the hero; a decorative letter-tile preview cascades in; setup chips + a player check-in strip give
// the moment context. The flow auto-advances (the host already started the game upstream — there's no
// host action to fire here), with longer dwell so the animation reads. Player audience gets a
// personalized line instead of the roster.
function IntroStage({
  title,
  description,
  rounds,
  secondsPerRound,
  players,
  audience,
  onDone,
  onMount,
}: {
  readonly title: string;
  readonly description?: string;
  readonly rounds?: number;
  readonly secondsPerRound?: number;
  readonly players: readonly CheckInPlayer[];
  readonly audience: FlowAudience;
  readonly onDone: () => void;
  readonly onMount: () => void;
}) {
  // Arm once on mount — immune to the flow re-rendering on every socket patch. 2.5s dwell is the
  // tested window where intro → countdown fires before the first backend patch (so the 3·2·1·GO
  // countdown reliably shows); a longer dwell lets the patch pre-empt it and the countdown is skipped.
  useOnMount(onMount);
  useTimeout(onDone, 2500);

  const chips: MetaChip[] = [];
  if (rounds !== undefined) chips.push({ label: `${rounds} rounds` });
  if (secondsPerRound !== undefined) chips.push({ label: `${secondsPerRound}s per word` });

  const isPlayer = audience === 'player';

  return (
    <Card size="lg" className="flex flex-col items-center gap-6 py-12 text-center">
      <Pill tone="action">Get ready</Pill>

      <PreviewTiles />

      <div className="flex flex-col items-center gap-3">
        <h1 className="font-serif text-[clamp(48px,12vw,96px)] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="max-w-[42ch] font-sans text-[18px] leading-snug text-ink-3">{description}</p>
        ) : null}
      </div>

      <MetaChips chips={chips} />

      {isPlayer ? (
        <p className="font-sans text-[14px] text-ink-3">
          The word will appear here — type it as fast as you can.
        </p>
      ) : (
        <CheckInRow players={players} />
      )}
    </Card>
  );
}

// ── Stage: countdown ──────────────────────────────────────────────────────────
// Server-driven when `deadline` is given (the backend COUNTDOWN phase): the numeral is computed from
// the SHARED deadline so every device counts together, and the backend's `round` patch ends it (no
// client onDone). Fallback to a client 3·2·1 (useCountdown → onDone) only when there's no deadline
// (e.g. mock/preview or a game that doesn't emit a countdown phase).
function CountdownStage({ deadline, onDone, onTick }: { readonly deadline?: number; readonly onDone: () => void; readonly onTick: () => void }) {
  if (deadline !== undefined) return <DeadlineCountdown deadline={deadline} onTick={onTick} />;
  return <ClientCountdown onDone={onDone} onTick={onTick} />;
}

// Numeral derived from a backend deadline (ceil of seconds remaining; 0 → "GO"). Ticks ~4×/sec so the
// flip is crisp; the backend flips the phase to `round` when the deadline fires.
function DeadlineCountdown({ deadline, onTick }: { readonly deadline: number; readonly onTick: () => void }) {
  const [count, setCount] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const last = useRef<number | null>(null);
  useEffect(() => {
    const compute = (): void => setCount(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    compute();
    const id = window.setInterval(compute, 250);
    return () => window.clearInterval(id);
  }, [deadline]);
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

function ClientCountdown({ onDone, onTick }: { readonly onDone: () => void; readonly onTick: () => void }) {
  const count = useCountdown(3, onDone); // useCountdown keeps onDone in a ref (mount-stable)
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

// ── Stage: round start ──────────────────────────────────────────────────────────
// The high-impact "GO!" takeover between rounds (Screen 4). A brief flash only — leaving it is
// BACKEND-timed by the flow hook (so it can't outlast the live round), not a client timer here. The
// headline varies per round to give the room a sense of pacing across the game.
const GO_HEADLINES = ['GO!', 'AGAIN!', 'KEEP GOING!', 'ALMOST THERE!', 'LAST ONE!'] as const;

function goHeadline(roundIndex: number, rounds?: number): string {
  // Final round always reads "LAST ONE!" when we know the count; otherwise step through the ladder.
  if (rounds !== undefined && roundIndex >= rounds - 1) return 'LAST ONE!';
  return GO_HEADLINES[Math.min(roundIndex, GO_HEADLINES.length - 1)] ?? 'GO!';
}

function RoundStartStage({ roundIndex, rounds }: { readonly roundIndex: number; readonly rounds?: number }) {
  const eyebrow = `Round ${roundIndex + 1}${rounds !== undefined ? ` of ${rounds}` : ''}`;
  return <GoTransition eyebrow={eyebrow} headline={goHeadline(roundIndex, rounds)} />;
}

// ── Stage: playing ──────────────────────────────────────────────────────────────
// The active, time-pressured beat. Gameplay is the hero: round eyebrow → full-width draining timer
// bar (the urgency device) → big cascading letter tiles → large auto-focused input → live presence
// row. Host controls live in the sticky strip (host-control-strip.tsx), not here.
function PlayingStage({
  patch,
  send,
  audience,
  play,
  players,
  youId,
  roundIndex,
  rounds,
}: {
  readonly patch: ViewPatch | null;
  readonly send: (action: Record<string, unknown>) => void;
  readonly audience: FlowAudience;
  readonly play: (k: SoundKey) => void;
  readonly players: readonly RoundPlayer[];
  readonly youId?: string;
  readonly roundIndex: number;
  readonly rounds?: number;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const masked = typeof patch?.masked === 'string' ? patch.masked : '';
  // ONE submission per round (backend rule): `locked` = you've submitted (right OR wrong) → no more
  // input, no retries. The right/wrong result is revealed at round end. This is what the UI keys off
  // now — `solved` (correct-only) never flips for a wrong guess, which is why wrong guesses looked
  // like "nothing happened" before.
  const locked = patch?.locked === true;
  const interactive = audience !== 'spectator';
  const deadline = typeof patch?.deadline === 'number' ? patch.deadline : undefined;
  const totalMs = typeof patch?.secondsPerRound === 'number' ? patch.secondsPerRound * 1000 : 20000;

  // Auto-focus the input when a fresh word appears (and the player hasn't locked in yet).
  useEffect(() => {
    if (interactive && !locked && masked !== '') inputRef.current?.focus();
  }, [masked, interactive, locked]);

  function submit() {
    const value = text.trim();
    if (value === '') {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'empty', audience }, { component: 'MissingLettersFlow.PlayingStage' });
      return;
    }
    if (locked) {
      log.event(LogEvent.GAME_SUBMIT_BLOCKED, { reason: 'already-locked', audience }, { component: 'MissingLettersFlow.PlayingStage' });
      return;
    }
    log.event(LogEvent.GAME_SUBMIT_ANSWER, { type: GUESS, text: value, len: value.length, audience }, { component: 'MissingLettersFlow.PlayingStage' });
    play(SoundKey.BUTTON_CLICK);
    send({ type: GUESS, text: value });
    setText('');
  }

  // The word comes from the live `round` patch. If it hasn't landed yet (a beat between phases),
  // show a brief loading line rather than empty slots (the old "no question" look).
  if (masked === '') {
    return (
      <Card size="lg" className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">Loading the word…</span>
      </Card>
    );
  }

  return (
    <Card size="lg" className="flex flex-col items-stretch gap-6 py-7">
      {/* Round eyebrow + the full-width draining timer bar = the urgency device. */}
      <div className="flex flex-col gap-3">
        <span className="text-center font-sans text-[12px] font-extrabold uppercase tracking-[0.14em] text-stage">
          Round {roundIndex + 1}
          {rounds !== undefined ? ` of ${rounds}` : ''}
        </span>
        {deadline !== undefined ? <TimerBar deadline={deadline} totalMs={totalMs} /> : null}
      </div>

      {/* Gameplay is the hero — big tiles, cascading in on each new word. */}
      <div className="flex flex-col items-center gap-2">
        <LetterSlots masked={masked} size="xl" cascade />
        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-4">Fill the word</span>
      </div>

      {interactive ? (
        locked ? (
          // Neutral lock state — no right/wrong hint; the result is revealed at round end (suspense).
          <div className="flex flex-col items-center justify-center gap-1 py-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-action-soft px-4 py-2 font-sans text-[15px] font-bold text-action-deep">
              Locked in ✓
            </span>
            <span className="font-sans text-[12px] text-ink-4">Find out at the reveal.</span>
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
              placeholder="Type the full word…"
              autoComplete="off"
              autoFocus
              className="rounded-input border-2 border-mist-soft bg-surface px-5 py-4 text-center font-sans text-[20px] tracking-wide text-ink focus:border-action focus:outline-none"
            />
            <Button variant="primary" size="lg" onClick={submit}>
              Submit
            </Button>
          </div>
        )
      ) : (
        <p className="text-center font-sans text-[14px] text-ink-3">Players are racing to fill the word…</p>
      )}

      {/* Live presence — who's in the round; the local player's locked-in state shown honestly. */}
      <RoundPresence players={players} youId={youId} youLocked={locked} />
    </Card>
  );
}

// ── Stage: reveal (letter by letter) ────────────────────────────────────────────
function RevealStage({ patch, onReveal }: { readonly patch: ViewPatch | null; readonly onReveal: () => void }) {
  const masked = typeof patch?.masked === 'string' ? patch.masked : '';
  const answer = typeof patch?.answer === 'string' ? patch.answer : undefined;
  useOnMount(onReveal);
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="font-sans text-[13px] font-bold uppercase tracking-[0.14em] text-ink-3">The word was</p>
      <LetterSlots masked={masked} answer={answer} size="lg" />
    </Card>
  );
}

// ── Stage: round scores (all players) ────────────────────────────────────────────
function boardRows(patch: ViewPatch | null, nameOf: (id: string) => string): ScoreRow[] {
  const board = patch?.board ?? [];
  return board.map((b) => ({
    ...(b.playerId !== undefined ? { id: b.playerId } : {}),
    name: b.name ?? (b.playerId !== undefined ? nameOf(b.playerId) : '—'),
    points: typeof b.points === 'number' ? b.points : 0,
    roundDelta: typeof b.roundDelta === 'number' ? b.roundDelta : 0,
  }));
}

function RoundScoresStage({ patch, nameOf, onMount }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string; readonly onMount: () => void }) {
  useOnMount(onMount);
  return (
    <Card size="lg" className="py-6">
      <RoundScores title="Round scores" rows={boardRows(patch, nameOf)} />
    </Card>
  );
}

// ── Stage: done ──────────────────────────────────────────────────────────────────
function DoneStage({ patch, nameOf }: { readonly patch: ViewPatch | null; readonly nameOf: (id: string) => string }) {
  return (
    <Card size="lg" className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-serif text-[28px] font-semibold text-ink">That’s a wrap</h2>
      <RoundScores title="Final scores" rows={boardRows(patch, nameOf)} />
    </Card>
  );
}
