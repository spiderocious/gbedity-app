import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import {
  ActorRole,
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

import { accrue, projectBoard, projectTiming } from '../shared/view-helpers';

// Plead Your Case (PRD §6.4 #18) — write a legal defence; an AI scores it on a rubric (criteria +
// weights from Mongo, prompt shell from env). Absolute scores per player → comparative ranking by
// total. Host can override the winner. AI fail → "evaluation failed" for that player (retry handled
// by the AI provider; Q5). Capability needsAI.

const Phase = { WRITING: 'writing', EVALUATING: 'evaluating', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { SUBMIT: 'plead.submit', OVERRIDE: 'plead.override' } as const;
const TimerKey = { WRITING: 'writing', EVALUATING: 'evaluating', REVEAL: 'reveal' } as const;
// (EVALUATING timer is the safety timeout for AI verdicts that never all return.)
const EventType = { SUBMIT: 'plead.submit' } as const;

const EVAL_TIMEOUT_S = 30; // safety: if AI verdicts never all return, reveal what we have

const configSchema = z.object({
  rounds: z.number().int().positive().default(3),
  argumentSeconds: z.number().int().positive().default(300),
  revealSeconds: z.number().int().positive().default(8),
});
type Config = z.infer<typeof configSchema>;

const criterion = z.object({ key: z.string(), label: z.string(), weight: z.number() });
const scenario = z.object({
  charge: z.string(),
  defendant: z.string(),
  facts: z.string(),
  laws: z.string(),
  precedents: z.string(),
});
const contentSchema = z.object({
  scenarios: z.array(scenario).min(1),
  rubric: z.array(criterion).min(1),
});
type Content = z.infer<typeof contentSchema>;

const submitAction = z.object({ type: z.literal(ActionType.SUBMIT), argument: z.string().min(1) });
const overrideAction = z.object({ type: z.literal(ActionType.OVERRIDE), winnerId: z.string() });
const actionSchema = z.discriminatedUnion('type', [submitAction, overrideAction]);
type Action = z.infer<typeof actionSchema>;

interface Result {
  playerId: string;
  ok: boolean; // false → "evaluation failed"
  total: number;
  perCriterion: { criterion: string; score: number; rationale: string }[];
}

interface State {
  phase: Phase;
  roundIndex: number;
  rounds: number;
  argumentSeconds: number;
  revealSeconds: number;
  scenarios: Content['scenarios'];
  rubric: Content['rubric'];
  deadline: EpochMs;
  submissions: { playerId: string; argument: string }[];
  pending: string[]; // refs awaiting AI verdict
  results: Result[];
  hostOverrideWinner: string | null;
  scores: Record<string, number>;
  lastDeltas: Record<string, number>; // this round's ranking points (board roundDelta + scoreRound)
}

const scenarioOf = (s: State): Content['scenarios'][number] => s.scenarios[s.roundIndex % s.scenarios.length]!;

// This round's points per player — rank successes by absolute total, 1st most descending. Single
// source for the board AND scoreRound.
const roundDeltasMap = (state: State): Record<string, number> => {
  const ranked = [...state.results].filter((r) => r.ok).sort((a, b) => b.total - a.total);
  const n = ranked.length;
  const out: Record<string, number> = {};
  ranked.forEach((r, i) => {
    out[r.playerId] = (n - i) * 100;
  });
  return out;
};
const refFor = (round: number, playerId: string): string => `pl_${round}_${playerId}`;

export const pleadYourCaseGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.PLEAD_YOUR_CASE,
    title: 'Plead Your Case',
    category: GameCategory.IMMERSIVE,
    mode: GameMode.SUBMIT_REVEAL,
    players: { min: 2, max: 10, recommendedMax: 10 },
    capabilities: { needsAI: true },
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const deadline = input.startedAt + input.config.argumentSeconds * 1000;
    return {
      state: {
        phase: Phase.WRITING,
        roundIndex: 0,
        rounds: input.config.rounds,
        argumentSeconds: input.config.argumentSeconds,
        revealSeconds: input.config.revealSeconds,
        scenarios: input.content.scenarios,
        rubric: input.content.rubric,
        deadline,
        submissions: [],
        pending: [],
        results: [],
        hostOverrideWinner: null,
        scores: Object.fromEntries(input.players.map((p) => [p.id, 0])),
        lastDeltas: {},
      },
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.WRITING, fireAt: deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    // AI verdict re-entering (§5).
    if (action.type === SystemActionType.SERVICE_RESULT) {
      if (state.phase !== Phase.EVALUATING) return { state, effects: [] };
      const playerId = state.pending.find((ref) => action.ref === ref)?.split('_').slice(2).join('_');
      const matchRef = state.pending.find((ref) => ref === action.ref);
      if (!matchRef) return { state, effects: [] };
      const verdict = action.result as { ok?: boolean; total?: number; perCriterion?: Result['perCriterion'] } | undefined;
      const pidFromRef = matchRef.split('_').slice(2).join('_');
      const result: Result = {
        playerId: playerId ?? pidFromRef,
        ok: verdict?.ok === true,
        total: typeof verdict?.total === 'number' ? verdict.total : 0,
        perCriterion: Array.isArray(verdict?.perCriterion) ? verdict.perCriterion : [],
      };
      const pending = state.pending.filter((r) => r !== matchRef);
      const results = [...state.results, result];
      const next = { ...state, pending, results };
      if (pending.length === 0) return finishEvaluation(next, ctx.now);
      return { state: next, effects: [{ kind: EffectKind.BROADCAST }] };
    }

    if (action.type === ActionType.OVERRIDE) {
      // HOST-ONLY — reject any non-host actor (BUG-A). Only meaningful at reveal.
      if (ctx.role !== ActorRole.HOST) return { state, effects: [] };
      if (state.phase !== Phase.REVEAL) return { state, effects: [] };
      return { state: { ...state, hostOverrideWinner: action.winnerId }, effects: [{ kind: EffectKind.BROADCAST }] };
    }

    // SUBMIT
    if (state.phase !== Phase.WRITING) return { state, effects: [] };
    if (state.submissions.some((s) => s.playerId === ctx.actor.id)) return { state, effects: [] };
    return {
      state: { ...state, submissions: [...state.submissions, { playerId: ctx.actor.id, argument: action.argument }] },
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: { roundIndex: state.roundIndex } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.WRITING) {
      // Writing window closed → fire one AI eval per submission, enter EVALUATING.
      const sc = scenarioOf(state);
      const pending = state.submissions.map((s) => refFor(state.roundIndex, s.playerId));
      const evalDeadline = nowMs + EVAL_TIMEOUT_S * 1000;
      const aiEffects = state.submissions.map((s) => ({
        kind: EffectKind.REQUEST_AI,
        ref: refFor(state.roundIndex, s.playerId),
        payload: {
          charge: sc.charge,
          defendant: sc.defendant,
          facts: sc.facts,
          laws: sc.laws,
          precedents: sc.precedents,
          argument: s.argument,
          criteria: state.rubric,
        },
      }));
      return {
        state: { ...state, phase: Phase.EVALUATING, pending, deadline: evalDeadline },
        effects: [
          ...aiEffects,
          { kind: EffectKind.START_TIMER, key: TimerKey.EVALUATING, fireAt: evalDeadline },
          { kind: EffectKind.BROADCAST },
        ],
      };
    }
    if (state.phase === Phase.EVALUATING) {
      // timeout — score whatever returned, mark the rest failed.
      return finishEvaluation(state, nowMs);
    }
    if (state.phase === Phase.REVEAL) {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      }
      const deadline = nowMs + state.argumentSeconds * 1000;
      return {
        state: { ...state, phase: Phase.WRITING, roundIndex: nextIndex, submissions: [], pending: [], results: [], hostOverrideWinner: null, deadline, lastDeltas: {} },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.WRITING, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const sc = scenarioOf(state);
    const phaseSeconds = state.phase === Phase.WRITING ? state.argumentSeconds : state.phase === Phase.EVALUATING ? EVAL_TIMEOUT_S : state.revealSeconds;
    const base: ViewPatch = {
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      scenario: { charge: sc.charge, defendant: sc.defendant, facts: sc.facts, laws: sc.laws, precedents: sc.precedents },
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, phaseSeconds),
      board: projectBoard(state.scores, state.lastDeltas),
    };
    if (state.phase === Phase.REVEAL) {
      const ranked = [...state.results].sort((a, b) => b.total - a.total);
      base.results = ranked.map((r) => ({ playerId: r.playerId, ok: r.ok, total: r.total, perCriterion: r.perCriterion }));
      base.winnerId = state.hostOverrideWinner ?? ranked.find((r) => r.ok)?.playerId ?? null;
    }
    if (audience.kind === AudienceKind.PLAYER) {
      base.submitted = state.submissions.some((s) => s.playerId === audience.playerId);
      base.yourScore = state.scores[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    // Read the deltas captured at the eval→reveal transition — one source for board + leaderboard.
    const deltas = Object.entries(state.lastDeltas).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    const n = Object.keys(state.lastDeltas).length;
    return { deltas, maxPoints: Math.max(100, n * 100) };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};

// Rank successes by absolute total (comparative from absolute); failed players score 0 (Q5).
// Ensures every submitter has a result — verdicts that never returned become failed.
const finishEvaluation = (state: State, nowMs: EpochMs): StepResult<State> => {
  const results: Result[] = state.submissions.map((s) => {
    const found = state.results.find((r) => r.playerId === s.playerId);
    return found ?? { playerId: s.playerId, ok: false, total: 0, perCriterion: [] };
  });
  const revealDeadline = nowMs + state.revealSeconds * 1000;
  const deltas = roundDeltasMap({ ...state, results });
  const scores = accrue(state.scores, deltas);
  return {
    state: { ...state, phase: Phase.REVEAL, results, pending: [], deadline: revealDeadline, scores, lastDeltas: deltas },
    effects: [
      { kind: EffectKind.CLEAR_TIMER, key: TimerKey.EVALUATING },
      { kind: EffectKind.BROADCAST },
      { kind: EffectKind.ROUND_ENDED },
      { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: revealDeadline },
    ],
  };
};
