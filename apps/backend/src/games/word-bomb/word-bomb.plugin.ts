import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import {
  AudienceKind,
  EffectKind,
  GameCategory,
  GameId,
  GameMode,
  SystemActionType,
} from '@engine/constants';
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

// Word Bomb (PRD §6.1 #6, updated rule) — round-robin, decaying bomb, hold-time scoring, no lives.
// Reuses the validation service (category fit, NO startsWith) + no-repeat set. Validation re-enters
// as a synthetic action (§5). The round-robin shape was de-risked by the engine's test game.

const Phase = { HOLDING: 'holding', AWAIT_VALIDATION: 'await_validation', BETWEEN: 'between', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { SUBMIT: 'word_bomb.submit' } as const;
const TimerKey = { BOMB: 'bomb', VALIDATION: 'validation' } as const;
const EventType = { SUBMIT: 'word_bomb.submit' } as const;

const DupHandling = { STRICT: 'strict', RELAXED: 'relaxed', SYNONYM: 'synonym' } as const;
type DupHandling = (typeof DupHandling)[keyof typeof DupHandling];

const configSchema = z.object({
  rounds: z.number().int().positive().default(3),
  bombSecondsStart: z.number().int().positive().default(7),
  decayPerRound: z.boolean().default(true),
  validationSeconds: z.number().int().positive().default(5),
  dupHandling: z.nativeEnum(DupHandling).default(DupHandling.STRICT),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ category: z.string() });
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.SUBMIT), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  round: number;
  rounds: number;
  category: string;
  bombSecondsStart: number;
  decayPerRound: boolean;
  validationSeconds: number;
  dupHandling: DupHandling;
  order: string[];
  turnIdx: number;
  turnStartedAt: EpochMs;
  deadline: EpochMs;
  used: string[];
  pendingRef: string | null;
  pendingPlayerId: string | null;
  pendingText: string | null;
  scores: Record<string, number>;
}

const holder = (s: State): string | undefined => s.order[s.turnIdx];

const bombMs = (s: State): number => {
  if (!s.decayPerRound) return s.bombSecondsStart * 1000;
  const decayed = Math.max(3, s.bombSecondsStart - s.round * 2); // 7→5→3…
  return decayed * 1000;
};

export const wordBombGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.WORD_BOMB,
    title: 'Word Bomb',
    category: GameCategory.QUICK,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 3, max: 10, recommendedMax: 10 },
    capabilities: { needsValidation: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const order = input.players.map((p) => p.id);
    const state: State = {
      phase: Phase.HOLDING,
      round: 0,
      rounds: input.config.rounds,
      category: input.content.category,
      bombSecondsStart: input.config.bombSecondsStart,
      decayPerRound: input.config.decayPerRound,
      validationSeconds: input.config.validationSeconds,
      dupHandling: input.config.dupHandling,
      order,
      turnIdx: 0,
      turnStartedAt: input.startedAt,
      deadline: input.startedAt + input.config.bombSecondsStart * 1000,
      used: [],
      pendingRef: null,
      pendingPlayerId: null,
      pendingText: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    return {
      state,
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.BOMB, fireAt: state.deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) {
      if (state.phase !== Phase.AWAIT_VALIDATION || action.ref !== state.pendingRef) return { state, effects: [] };
      const verdict = action.result as { ok?: boolean } | undefined;
      const ok = verdict?.ok === true;
      const playerId = state.pendingPlayerId;
      const heldMs = ctx.now - state.turnStartedAt;
      const scores = { ...state.scores };
      const used = [...state.used];
      if (ok && playerId) {
        scores[playerId] = (scores[playerId] ?? 0) + Math.max(1, Math.round(heldMs / 100));
        used.push(state.pendingText ?? '');
      }
      return advance({ ...state, scores, used, pendingRef: null, pendingPlayerId: null, pendingText: null }, ctx.now);
    }

    if (state.phase !== Phase.HOLDING || holder(state) !== ctx.actor.id) return { state, effects: [] };
    const ref = `wb_${state.round}_${state.turnIdx}`;
    const validationDeadline = ctx.now + state.validationSeconds * 1000;
    return {
      state: { ...state, phase: Phase.AWAIT_VALIDATION, pendingRef: ref, pendingPlayerId: ctx.actor.id, pendingText: action.text, deadline: validationDeadline },
      effects: [
        { kind: EffectKind.CLEAR_TIMER, key: TimerKey.BOMB },
        { kind: EffectKind.START_TIMER, key: TimerKey.VALIDATION, fireAt: validationDeadline },
        {
          kind: EffectKind.REQUEST_VALIDATION,
          ref,
          payload: { word: action.text, category: state.category, dupHandling: state.dupHandling, used: state.used },
        },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: { round: state.round } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    // bomb timeout (holder didn't submit) OR validation timeout → advance, no score.
    if (state.phase === Phase.HOLDING || state.phase === Phase.AWAIT_VALIDATION) {
      return advance({ ...state, pendingRef: null, pendingPlayerId: null, pendingText: null }, nowMs);
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const base: ViewPatch = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      category: state.category,
      holderId: holder(state) ?? null,
      used: state.used,
    };
    if (audience.kind === AudienceKind.PLAYER) {
      base.yourTurn = holder(state) === audience.playerId && state.phase === Phase.HOLDING;
      base.yourScore = state.scores[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(state.scores).map(([playerId, points]) => ({
      playerId,
      points,
      reason: MESSAGE_KEYS.common.OK,
    }));
    const maxPoints = Math.max(1, ...Object.values(state.scores));
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};

// Advance the bomb. A full rotation = one round; after `rounds` rotations → done.
const advance = (state: State, nowMs: EpochMs): StepResult<State> => {
  const nextIdx = state.turnIdx + 1;
  const wrapped = nextIdx >= state.order.length;
  const nextRound = wrapped ? state.round + 1 : state.round;

  if (wrapped && nextRound >= state.rounds) {
    return {
      state: { ...state, phase: Phase.DONE },
      effects: [
        { kind: EffectKind.CLEAR_TIMER, key: TimerKey.BOMB },
        { kind: EffectKind.CLEAR_TIMER, key: TimerKey.VALIDATION },
        { kind: EffectKind.BROADCAST },
        { kind: EffectKind.ROUND_ENDED },
        { kind: EffectKind.GAME_ENDED },
      ],
    };
  }

  const next: State = {
    ...state,
    phase: Phase.HOLDING,
    round: nextRound,
    turnIdx: wrapped ? 0 : nextIdx,
    turnStartedAt: nowMs,
    used: wrapped ? [] : state.used, // reset no-repeat each round
  };
  next.deadline = nowMs + bombMs(next);
  return {
    state: next,
    effects: [
      { kind: EffectKind.CLEAR_TIMER, key: TimerKey.VALIDATION },
      { kind: EffectKind.CLEAR_TIMER, key: TimerKey.BOMB },
      { kind: EffectKind.START_TIMER, key: TimerKey.BOMB, fireAt: next.deadline },
      { kind: EffectKind.BROADCAST },
    ],
  };
};
