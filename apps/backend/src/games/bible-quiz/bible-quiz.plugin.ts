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

// Bible Quiz (PRD §6.1 #2) — same mechanic as Quizzes (4-option MCQ, time-weighted, answer secrecy)
// but scripture decks with translation + testament filters. Own plugin + own decks. Content resolved
// server-side from `bible_quiz_decks`.

const Phase = { QUESTION: 'question', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { ANSWER: 'bible_quiz.answer' } as const;
const TimerKey = { QUESTION: 'question', REVEAL: 'reveal' } as const;
const EventType = { ANSWERED: 'bible_quiz.answered' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(10),
  secondsPerQuestion: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
  translation: z.enum(['mixed', 'kjv', 'niv', 'nlt', 'yoruba', 'igbo', 'hausa']).default('mixed'),
  testament: z.enum(['both', 'old', 'new']).default('both'),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()).length(4), answerIdx: z.number().int().min(0).max(3) })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.ANSWER), questionIdx: z.number().int().min(0), choiceIdx: z.number().int().min(0).max(3) });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  qIndex: number;
  rounds: number;
  secondsPerQuestion: number;
  revealSeconds: number;
  questions: Content['questions'];
  deadline: EpochMs;
  answers: { playerId: string; choiceIdx: number; at: EpochMs }[];
}

const POINTS_MAX = 1000;
const cur = (s: State): Content['questions'][number] | undefined => s.questions[s.qIndex];

export const bibleQuizGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.BIBLE_QUIZ,
    title: 'Bible Quiz',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.questions.length);
    const deadline = input.startedAt + input.config.secondsPerQuestion * 1000;
    return {
      state: {
        phase: Phase.QUESTION,
        qIndex: 0,
        rounds,
        secondsPerQuestion: input.config.secondsPerQuestion,
        revealSeconds: input.config.revealSeconds,
        questions: input.content.questions,
        deadline,
        answers: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.QUESTION || action.questionIdx !== state.qIndex) return { state, effects: [] };
    if (state.answers.some((a) => a.playerId === ctx.actor.id)) return { state, effects: [] };
    return {
      state: { ...state, answers: [...state.answers, { playerId: ctx.actor.id, choiceIdx: action.choiceIdx, at: ctx.now }] },
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.ANSWERED, data: { qIndex: state.qIndex } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.QUESTION) {
      const d = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const next = state.qIndex + 1;
      if (next >= state.rounds) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      const d = nowMs + state.secondsPerQuestion * 1000;
      return {
        state: { ...state, phase: Phase.QUESTION, qIndex: next, answers: [], deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const q = cur(state);
    const base: ViewPatch = { phase: state.phase, qIndex: state.qIndex, rounds: state.rounds, prompt: q?.prompt ?? null, options: q?.options ?? [] };
    if (state.phase === Phase.REVEAL && q) base.answerIdx = q.answerIdx;
    if (audience.kind === AudienceKind.PLAYER) base.answered = state.answers.some((a) => a.playerId === audience.playerId);
    return base;
  },

  scoreRound(state: State): RoundScore {
    const q = cur(state);
    if (!q) return { deltas: [], maxPoints: POINTS_MAX };
    const windowMs = state.secondsPerQuestion * 1000;
    const deltas = state.answers
      .filter((a) => a.choiceIdx === q.answerIdx)
      .map((a) => {
        const usedMs = Math.max(0, a.at - (state.deadline - windowMs));
        const frac = Math.max(0, 1 - usedMs / windowMs);
        return { playerId: a.playerId, points: Math.round(POINTS_MAX * (0.5 + 0.5 * frac)), reason: MESSAGE_KEYS.common.OK };
      });
    return { deltas, maxPoints: POINTS_MAX };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
