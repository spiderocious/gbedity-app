import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import { AudienceKind, EffectKind, GameCategory, GameId, GameMode, SystemActionType } from '@engine/constants';
import type {
  ActionCtx,
  Audience,
  GamePlugin,
  InitInput,
  RoundScore,
  ServiceResultAction,
  StepResult,
  TickCtx,
  ViewPatch,
} from '@engine/types';

// Missing Letters (PRD §6.1 #8) — a word with gaps ("B _ N _ N _"); players race to type the full
// word. Exact-match against the known answer (no validation service). Content (word + masked
// positions) resolved server-side from the word DB.

// COUNTDOWN is a brief server-timed "get ready" beat BEFORE round 1 — it gives every client (host,
// players, display) a shared deadline to run the 3·2·1·GO intro off, so the countdown always shows
// AND stays in sync (a client-only timer raced the first round patch → either skipped or desynced).
const Phase = { COUNTDOWN: 'countdown', ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { GUESS: 'missing_letters.guess' } as const;
const TimerKey = { COUNTDOWN: 'countdown', ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { GUESS: 'missing_letters.guess' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(8),
  secondsPerRound: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
  // The pre-round-1 countdown beat (3·2·1·GO). Server-timed so all devices share the deadline.
  countdownSeconds: z.number().int().min(1).max(10).default(4),
  // How many letters to mask. MUST be in the schema or Zod's .parse() strips it and the resolver
  // silently falls back to its default — i.e. host config is ignored. Default 2, capped at 3:
  // hiding 3+ blank letters with no letter bank is near-unguessable, so we keep it low.
  hiddenCount: z.number().int().min(1).max(3).default(2),
  // Word-length band — also read by the resolver; declared here so it isn't stripped either.
  minLen: z.number().int().min(3).max(12).optional(),
  maxLen: z.number().int().min(3).max(14).optional(),
});
type Config = z.infer<typeof configSchema>;

// Each round: the answer + the indices revealed (the rest are blanks).
const contentSchema = z.object({
  words: z.array(z.object({ answer: z.string().min(1), revealed: z.array(z.number().int()) })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.GUESS), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  countdownSeconds: number;
  words: Content['words'];
  deadline: EpochMs;
  solved: { playerId: string; at: EpochMs }[]; // correct guessers this round, in order
  // Everyone who has SUBMITTED this round (right OR wrong). One submission per round — once you're
  // here you're locked out; no retries. `solved` ⊆ `answered` (correct submitters also score).
  answered: string[];
  totals: Record<string, number>; // cumulative score per player across rounds (for the board)
}

const POINTS = 1000;
const cur = (s: State): Content['words'][number] | undefined => s.words[s.idx];

// Per-round points: faster solvers score more (rank order). Single source for both scoreRound (the
// league/leaderboard seam) and the in-patch board, so they never drift.
const roundDeltas = (solved: State['solved']): Record<string, number> => {
  const out: Record<string, number> = {};
  solved.forEach((s, rank) => {
    out[s.playerId] = Math.max(100, POINTS - rank * 100);
  });
  return out;
};

// Masked display: revealed letters shown, others as "_".
const masked = (w: Content['words'][number]): string =>
  w.answer
    .split('')
    .map((ch, i) => (w.revealed.includes(i) ? ch : '_'))
    .join(' ');

export const missingLettersGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.MISSING_LETTERS,
    title: 'Missing Letters',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 10 },
    capabilities: {},
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.words.length);
    // Start in the COUNTDOWN beat: the deadline is when round 1 begins. All clients run 3·2·1·GO off
    // this shared deadline; the COUNTDOWN timer flips us to round 1 (onTick) when it fires.
    const deadline = input.startedAt + input.config.countdownSeconds * 1000;
    return {
      state: {
        phase: Phase.COUNTDOWN,
        idx: 0,
        rounds,
        secondsPerRound: input.config.secondsPerRound,
        revealSeconds: input.config.revealSeconds,
        countdownSeconds: input.config.countdownSeconds,
        words: input.content.words,
        deadline,
        solved: [],
        answered: [],
        totals: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.COUNTDOWN, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    // ONE submission per round — right or wrong. Already answered → locked out, no retries.
    if (state.answered.includes(ctx.actor.id)) return { state, effects: [] };
    const word = cur(state);
    if (!word) return { state, effects: [] };

    const answered = [...state.answered, ctx.actor.id];
    const correct = action.text.trim().toLowerCase() === word.answer.toLowerCase();
    // Either way the player is now locked (answered). Correct submitters ALSO join `solved` (scored
    // by speed). The TO_PLAYER re-projection carries `locked: true`, so the client shows "Locked in".
    const nextState: State = correct
      ? { ...state, answered, solved: [...state.solved, { playerId: ctx.actor.id, at: ctx.now }] }
      : { ...state, answered };
    return {
      state: nextState,
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        ...(correct ? [{ kind: EffectKind.PERSIST_EVENT, event: { type: EventType.GUESS, data: { idx: state.idx } } } as const] : []),
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    // Countdown beat finished → start round 1 (set its deadline + round timer).
    if (state.phase === Phase.COUNTDOWN) {
      const d = nowMs + state.secondsPerRound * 1000;
      return {
        state: { ...state, phase: Phase.ROUND, idx: 0, solved: [], answered: [], deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    if (state.phase === Phase.ROUND) {
      const d = nowMs + state.revealSeconds * 1000;
      // Fold this round's deltas into the cumulative totals BEFORE the reveal broadcast, so the
      // reveal patch's board shows everyone's running score incl. this round (round-scores screen).
      const deltas = roundDeltas(state.solved);
      const totals = { ...state.totals };
      for (const [id, pts] of Object.entries(deltas)) totals[id] = (totals[id] ?? 0) + pts;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d, totals },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const next = state.idx + 1;
      if (next >= state.rounds) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      const d = nowMs + state.secondsPerRound * 1000;
      return {
        state: { ...state, phase: Phase.ROUND, idx: next, solved: [], answered: [], deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const word = cur(state);
    // Cumulative board (running totals + this round's delta) — drives the all-players scores +
    // the round-scores screen, for every audience incl. spectators. roundDelta is only meaningful
    // at reveal (the round just scored); 0 during play.
    const thisRound = state.phase === Phase.REVEAL ? roundDeltas(state.solved) : {};
    // `?? {}` guards a recovered/partial state where `totals` is absent — view() must never throw
    // (it runs during rehydrate; a throw there crashes recovery for the whole room).
    const board = Object.entries(state.totals ?? {})
      .map(([playerId, points]) => ({ playerId, points, roundDelta: thisRound[playerId] ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const base: ViewPatch = {
      phase: state.phase,
      idx: state.idx,
      rounds: state.rounds,
      masked: word ? masked(word) : null,
      length: word?.answer.length ?? 0,
      deadline: state.deadline, // absolute epoch-ms — client renders the countdown ring
      secondsPerRound: state.secondsPerRound,
      revealSeconds: state.revealSeconds, // the reveal-phase window — client splits reveal→scores by it
      board,
    };
    if (state.phase === Phase.REVEAL && word) base.answer = word.answer; // secrecy: only at reveal
    if (audience.kind === AudienceKind.PLAYER) {
      // `locked`: this player has submitted this round (right OR wrong) → one shot, no retries; the
      // client shows "Locked in". `solved` stays correct-only (kept for chrome that wants it).
      base.locked = state.answered.includes(audience.playerId);
      base.solved = state.solved.some((s) => s.playerId === audience.playerId);
      base.yourScore = state.totals[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    // faster solvers score more (rank order within the round) — same math as the in-patch board.
    const deltas = Object.entries(roundDeltas(state.solved)).map(([playerId, points]) => ({
      playerId,
      points,
      reason: MESSAGE_KEYS.common.OK,
    }));
    return { deltas, maxPoints: POINTS };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
