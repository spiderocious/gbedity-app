import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';

import { AudienceKind, EffectKind, GameCategory, GameId, GameMode, SystemActionType } from '../constants';
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
} from '../types';

// TEST GAME B — round-robin (game-engine.md §8). NOT a catalogue game. Proves the contract handles:
// turn assignment, a runtime-owned per-turn timer, and an ASYNC validation request mid-turn that
// resumes the plugin synchronously via a synthetic service-result action (§5). Deliberately tiny.

const Phase = { TURN: 'turn', AWAIT_VALIDATION: 'await_validation', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { SUBMIT: 'test_rr.submit' } as const;
const TimerKey = { TURN: 'turn' } as const;

const configSchema = z.object({
  turnSeconds: z.number().int().positive().default(10),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  prompt: z.string().default('say something'),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({
  type: z.literal(ActionType.SUBMIT),
  text: z.string().min(1),
});
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  prompt: string;
  turnSeconds: number;
  order: string[]; // playerIds in rotation
  turnIdx: number;
  turnStartedAt: EpochMs;
  deadline: EpochMs;
  pendingRef: string | null;
  pendingPlayerId: string | null;
  scores: Record<string, number>;
}

const holder = (s: State): string | undefined => s.order[s.turnIdx];

export const roundRobinTestGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.TEST_ROUND_ROBIN,
    title: 'Test — Round Robin',
    category: GameCategory.QUICK,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 2, max: 10, recommendedMax: 10 },
    capabilities: { needsValidation: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const order = input.players.map((p) => p.id);
    const deadline = input.startedAt + input.config.turnSeconds * 1000;
    const state: State = {
      phase: Phase.TURN,
      prompt: input.content.prompt,
      turnSeconds: input.config.turnSeconds,
      order,
      turnIdx: 0,
      turnStartedAt: input.startedAt,
      deadline,
      pendingRef: null,
      pendingPlayerId: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    return {
      state,
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    // Async validation verdict re-entering (§5).
    if (action.type === SystemActionType.SERVICE_RESULT) {
      if (state.phase !== Phase.AWAIT_VALIDATION || action.ref !== state.pendingRef) {
        return { state, effects: [] };
      }
      const ok = isOkResult(action.result);
      const heldMs = ctx.now - state.turnStartedAt;
      const playerId = state.pendingPlayerId;
      const scores = { ...state.scores };
      if (ok && playerId) scores[playerId] = (scores[playerId] ?? 0) + Math.max(1, Math.round(heldMs / 100));
      return advanceTurn({ ...state, scores, pendingRef: null, pendingPlayerId: null }, ctx.now);
    }

    // Only the current holder may submit.
    if (state.phase !== Phase.TURN || holder(state) !== ctx.actor.id) {
      return { state, effects: [] };
    }
    const ref = `val_${state.turnIdx}_${ctx.actor.id}`;
    const next: State = { ...state, phase: Phase.AWAIT_VALIDATION, pendingRef: ref, pendingPlayerId: ctx.actor.id };
    return {
      state: next,
      effects: [{ kind: EffectKind.REQUEST_VALIDATION, ref, payload: { text: action.text } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase !== Phase.TURN) return { state, effects: [] };
    // Holder timed out → score 0, advance.
    return advanceTurn(state, nowMs);
  },

  view(state: State, audience: Audience): ViewPatch {
    const base: ViewPatch = { phase: state.phase, prompt: state.prompt, holderId: holder(state) ?? null };
    if (audience.kind === AudienceKind.PLAYER) {
      base.yourTurn = holder(state) === audience.playerId && state.phase === Phase.TURN;
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

// One full rotation = one round; after everyone has had a turn the game ends.
const advanceTurn = (state: State, nowMs: EpochMs): StepResult<State> => {
  const nextIdx = state.turnIdx + 1;
  if (nextIdx >= state.order.length) {
    return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.GAME_ENDED }] };
  }
  const deadline = nowMs + state.turnSeconds * 1000;
  return {
    state: { ...state, phase: Phase.TURN, turnIdx: nextIdx, turnStartedAt: nowMs, deadline },
    effects: [
      { kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN },
      { kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: deadline },
      { kind: EffectKind.BROADCAST },
    ],
  };
};

const isOkResult = (result: unknown): boolean =>
  typeof result === 'object' && result !== null && 'ok' in result && (result as { ok: unknown }).ok === true;
