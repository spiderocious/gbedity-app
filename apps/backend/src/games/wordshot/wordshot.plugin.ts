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

import { projectBoard, projectTiming } from '../shared/view-helpers';

// Wordshot (PRD §6.1 #5) — simultaneous, letter+category, live top-N ranking, real validation.
// Content (the round plan: letter+category per round) is resolved server-side. Submissions go to
// the validation service via REQUEST_VALIDATION; verdicts re-enter as synthetic actions (§5).

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { SUBMIT: 'wordshot.submit' } as const;
const TimerKey = { ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { SUBMIT: 'wordshot.submit' } as const;

const DupHandling = { STRICT: 'strict', RELAXED: 'relaxed', SYNONYM: 'synonym' } as const;
type DupHandling = (typeof DupHandling)[keyof typeof DupHandling];

const configSchema = z.object({
  rounds: z.number().int().positive().default(10),
  secondsPerRound: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
  dupHandling: z.nativeEnum(DupHandling).default(DupHandling.STRICT),
  rankingDisplayCount: z.number().int().positive().default(5),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  plan: z.array(z.object({ letter: z.string().length(1), category: z.string() })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.SUBMIT), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface Submission {
  playerId: string;
  text: string;
  at: EpochMs;
  valid?: boolean;
  score?: number;
}

interface State {
  phase: Phase;
  roundIndex: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  dupHandling: DupHandling;
  rankingDisplayCount: number;
  plan: Content['plan'];
  deadline: EpochMs;
  submissions: Submission[];
  scored: Record<string, number>; // cumulative this game
}

const cur = (s: State): Content['plan'][number] | undefined => s.plan[s.roundIndex];

const refFor = (roundIndex: number, playerId: string): string => `ws_${roundIndex}_${playerId}`;

// This round's points per player (submissions reset each round, so the current round's valid scores
// ARE the round deltas) — feeds the board's roundDelta. Totals come from `scored` (already cumulative).
const roundDeltasMap = (state: State): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const s of state.submissions) {
    if (s.valid && typeof s.score === 'number') out[s.playerId] = (out[s.playerId] ?? 0) + s.score;
  }
  return out;
};

export const wordshotGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.WORDSHOT,
    title: 'Wordshot',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 10 },
    capabilities: { needsValidation: true },
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.plan.length);
    const deadline = input.startedAt + input.config.secondsPerRound * 1000;
    return {
      state: {
        phase: Phase.ROUND,
        roundIndex: 0,
        rounds,
        secondsPerRound: input.config.secondsPerRound,
        revealSeconds: input.config.revealSeconds,
        dupHandling: input.config.dupHandling,
        rankingDisplayCount: input.config.rankingDisplayCount,
        plan: input.content.plan,
        deadline,
        submissions: [],
        scored: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      },
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) {
      // Validation verdict re-entering (§5). Match by ref → mark the submission.
      const idx = state.submissions.findIndex((s) => refFor(state.roundIndex, s.playerId) === action.ref);
      if (idx < 0) return { state, effects: [] };
      const verdict = action.result as { ok?: boolean } | undefined;
      const valid = verdict?.ok === true;
      const sub = state.submissions[idx]!;
      const windowMs = state.secondsPerRound * 1000;
      const usedMs = Math.max(0, sub.at - (state.deadline - windowMs));
      const score = valid ? Math.round(1000 * (0.5 + 0.5 * Math.max(0, 1 - usedMs / windowMs))) : 0;
      const submissions = [...state.submissions];
      submissions[idx] = { ...sub, valid, score };
      const scored = { ...state.scored };
      if (valid) scored[sub.playerId] = (scored[sub.playerId] ?? 0) + score;
      return {
        state: { ...state, submissions, scored },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.TO_PLAYER, playerId: sub.playerId }],
      };
    }

    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    if (state.submissions.some((s) => s.playerId === ctx.actor.id)) return { state, effects: [] };

    const round = cur(state);
    if (!round) return { state, effects: [] };
    const sub: Submission = { playerId: ctx.actor.id, text: action.text, at: ctx.now };
    return {
      state: { ...state, submissions: [...state.submissions, sub] },
      effects: [
        {
          kind: EffectKind.REQUEST_VALIDATION,
          ref: refFor(state.roundIndex, ctx.actor.id),
          payload: {
            word: action.text,
            category: round.category,
            startsWith: round.letter,
            dupHandling: state.dupHandling,
            used: state.submissions.filter((s) => s.valid).map((s) => s.text),
          },
        },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: { roundIndex: state.roundIndex } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.ROUND) {
      const revealDeadline = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: revealDeadline },
        effects: [
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.ROUND_ENDED },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: revealDeadline },
        ],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      }
      const deadline = nowMs + state.secondsPerRound * 1000;
      return {
        state: { ...state, phase: Phase.ROUND, roundIndex: nextIndex, submissions: [], deadline },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const round = cur(state);
    const ranked = state.submissions
      .filter((s) => s.valid && typeof s.score === 'number')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, state.rankingDisplayCount)
      .map((s) => ({ text: s.text, score: s.score ?? 0 }));
    const base: ViewPatch = {
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      letter: round?.letter ?? null,
      category: round?.category ?? null,
      ranked, // live top-N (display)
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, state.secondsPerRound),
      board: projectBoard(state.scored, roundDeltasMap(state)),
    };
    if (audience.kind === AudienceKind.PLAYER) {
      const own = state.submissions.find((s) => s.playerId === audience.playerId);
      base.yourScore = state.scored[audience.playerId] ?? 0;
      base.yourSubmission = own ? { text: own.text, valid: own.valid ?? null, score: own.score ?? null } : null;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    // Score the just-finished round's valid submissions (already computed on verdict).
    const deltas = state.submissions
      .filter((s) => s.valid)
      .map((s) => ({ playerId: s.playerId, points: s.score ?? 0, reason: MESSAGE_KEYS.common.OK }));
    return { deltas, maxPoints: 1000 };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
