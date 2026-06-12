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

import { accrue, projectBoard, projectTiming } from '../shared/view-helpers';

// Quizzes (PRD §6.1 #1) — simultaneous multiple-choice. Real catalogue game. Content (the question
// deck) is resolved + rating-filtered server-side by the content service BEFORE init (the plugin
// receives clean questions). Proves: content path, time-weighted scoring, answer secrecy, league.

const Phase = { QUESTION: 'question', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { ANSWER: 'quizzes.answer' } as const;
const TimerKey = { QUESTION: 'question', REVEAL: 'reveal' } as const;
const EventType = { ANSWERED: 'quizzes.answered', ROUND: 'quizzes.round' } as const;

const ScoringMode = { TIME_WEIGHTED: 'time_weighted', FLAT: 'flat' } as const;
type ScoringMode = (typeof ScoringMode)[keyof typeof ScoringMode];

const configSchema = z.object({
  rounds: z.number().int().positive().default(10),
  secondsPerQuestion: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
  scoringMode: z.nativeEnum(ScoringMode).default(ScoringMode.TIME_WEIGHTED),
  wrongPenaltyPct: z.number().min(0).max(100).default(0),
  category: z.string().default('general'),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()).length(4),
        answerIdx: z.number().int().min(0).max(3),
      }),
    )
    .min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({
  type: z.literal(ActionType.ANSWER),
  questionIdx: z.number().int().min(0),
  choiceIdx: z.number().int().min(0).max(3),
});
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  qIndex: number;
  rounds: number;
  secondsPerQuestion: number;
  revealSeconds: number;
  scoringMode: ScoringMode;
  wrongPenaltyPct: number;
  questions: Content['questions'];
  deadline: EpochMs;
  answers: { playerId: string; choiceIdx: number; at: EpochMs }[];
  totals: Record<string, number>; // cumulative score per player (for the board)
  lastDeltas: Record<string, number>; // this round's points per player (for the board's roundDelta)
}

const POINTS_MAX = 1000;
const currentQ = (s: State): Content['questions'][number] | undefined => s.questions[s.qIndex];

// This round's points per player — the single source for both scoreRound (the league/leaderboard
// seam) and the in-patch board, so they never drift.
const roundDeltasMap = (state: State): Record<string, number> => {
  const q = currentQ(state);
  if (!q) return {};
  const out: Record<string, number> = {};
  for (const a of state.answers) {
    const correct = a.choiceIdx === q.answerIdx;
    if (!correct) {
      out[a.playerId] = -Math.round((state.wrongPenaltyPct / 100) * POINTS_MAX);
    } else if (state.scoringMode === ScoringMode.FLAT) {
      out[a.playerId] = POINTS_MAX;
    } else {
      const windowMs = state.secondsPerQuestion * 1000;
      const usedMs = Math.max(0, a.at - (state.deadline - windowMs));
      const frac = Math.max(0, 1 - usedMs / windowMs);
      out[a.playerId] = Math.round(POINTS_MAX * (0.5 + 0.5 * frac));
    }
  }
  return out;
};

export const quizzesGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.QUIZZES,
    title: 'Quizzes',
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
    const rounds = Math.min(input.config.rounds, input.content.questions.length);
    const deadline = input.startedAt + input.config.secondsPerQuestion * 1000;
    const state: State = {
      phase: Phase.QUESTION,
      qIndex: 0,
      rounds,
      secondsPerQuestion: input.config.secondsPerQuestion,
      revealSeconds: input.config.revealSeconds,
      scoringMode: input.config.scoringMode,
      wrongPenaltyPct: input.config.wrongPenaltyPct,
      questions: input.content.questions,
      deadline,
      answers: [],
      totals: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      lastDeltas: {},
    };
    return {
      state,
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.QUESTION || action.questionIdx !== state.qIndex) return { state, effects: [] };
    if (state.answers.some((a) => a.playerId === ctx.actor.id)) return { state, effects: [] };

    const next: State = {
      ...state,
      answers: [...state.answers, { playerId: ctx.actor.id, choiceIdx: action.choiceIdx, at: ctx.now }],
    };
    return {
      state: next,
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.ANSWERED, data: { qIndex: state.qIndex } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.QUESTION) {
      const revealDeadline = nowMs + state.revealSeconds * 1000;
      // Fold this round's deltas into totals BEFORE overwriting deadline (the time-weighted calc
      // depends on the QUESTION deadline) and before the reveal broadcast (so the board is current).
      const deltas = roundDeltasMap(state);
      const totals = accrue(state.totals, deltas);
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: revealDeadline, totals, lastDeltas: deltas },
        effects: [
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.ROUND_ENDED },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: revealDeadline },
        ],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const nextIndex = state.qIndex + 1;
      if (nextIndex >= state.rounds) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      }
      const nextDeadline = nowMs + state.secondsPerQuestion * 1000;
      return {
        state: { ...state, phase: Phase.QUESTION, qIndex: nextIndex, answers: [], deadline: nextDeadline, lastDeltas: {} },
        effects: [
          { kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: nextDeadline },
          { kind: EffectKind.BROADCAST },
        ],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const q = currentQ(state);
    const base: ViewPatch = {
      phase: state.phase,
      qIndex: state.qIndex,
      rounds: state.rounds,
      prompt: q?.prompt ?? null,
      options: q?.options ?? [],
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, state.secondsPerQuestion),
      board: projectBoard(state.totals, state.lastDeltas),
    };
    // answer secrecy: correct option only revealed at REVEAL, to any audience.
    if (state.phase === Phase.REVEAL && q) base.answerIdx = q.answerIdx;
    if (audience.kind === AudienceKind.PLAYER) {
      base.answered = state.answers.some((a) => a.playerId === audience.playerId);
      base.yourScore = state.totals[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    // Use the deltas captured at the QUESTION→REVEAL transition (computed with the question's
    // deadline). ROUND_ENDED fires after that transition, so recomputing here would use the reveal
    // deadline and mis-score the time bonus. One source — board + leaderboard never drift.
    const deltas = Object.entries(state.lastDeltas).map(([playerId, points]) => ({
      playerId,
      points,
      reason: MESSAGE_KEYS.common.OK,
    }));
    return { deltas, maxPoints: POINTS_MAX };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
