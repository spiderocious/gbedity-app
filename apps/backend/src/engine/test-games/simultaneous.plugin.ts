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

// TEST GAME A — simultaneous (game-engine.md §8). NOT a catalogue game. Exists only to prove the
// contract handles: simultaneous ingestion, per-question runtime timer, server-side answer secrecy
// via view(), and time-weighted scoring. Deliberately tiny.

const Phase = { QUESTION: 'question', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { ANSWER: 'test_sim.answer' } as const;

// Both phases use a runtime-owned timer: QUESTION → REVEAL (answer window), then REVEAL →
// next/DONE (the reveal beat). Without the reveal timer the game hangs in REVEAL forever.
const TimerKey = { QUESTION: 'question', REVEAL: 'reveal' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(1),
  secondsPerQuestion: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  questions: z
    .array(z.object({ id: z.string(), prompt: z.string(), target: z.number() }))
    .min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({
  type: z.literal(ActionType.ANSWER),
  questionId: z.string(),
  value: z.number(),
});
type Action = z.infer<typeof actionSchema>;

interface Answer {
  playerId: string;
  value: number;
  at: EpochMs;
}

interface State {
  phase: Phase;
  qIndex: number;
  rounds: number;
  secondsPerQuestion: number;
  revealSeconds: number;
  questions: Content['questions'];
  deadline: EpochMs;
  answers: Answer[]; // for the current question only
}

const currentQuestion = (s: State): Content['questions'][number] | undefined => s.questions[s.qIndex];

export const simultaneousTestGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.TEST_SIMULTANEOUS,
    title: 'Test — Simultaneous',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 1, max: null, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const deadline = input.startedAt + input.config.secondsPerQuestion * 1000;
    const state: State = {
      phase: Phase.QUESTION,
      qIndex: 0,
      rounds: input.config.rounds,
      secondsPerQuestion: input.config.secondsPerQuestion,
      revealSeconds: input.config.revealSeconds,
      questions: input.content.questions,
      deadline,
      answers: [],
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
    if (state.phase !== Phase.QUESTION) return { state, effects: [] };
    if (state.answers.some((a) => a.playerId === ctx.actor.id)) return { state, effects: [] };

    const next: State = {
      ...state,
      answers: [...state.answers, { playerId: ctx.actor.id, value: action.value, at: ctx.now }],
    };
    return { state: next, effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }] };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.QUESTION) {
      // Question window closed → reveal. Arm a REVEAL timer so onTick fires again to advance;
      // without it the game would hang in reveal forever (BUG-01).
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
      // Reveal beat elapsed → next question or DONE.
      const nextIndex = state.qIndex + 1;
      if (nextIndex >= state.rounds || nextIndex >= state.questions.length) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      }
      const nextDeadline = nowMs + state.secondsPerQuestion * 1000;
      return {
        state: { ...state, phase: Phase.QUESTION, qIndex: nextIndex, answers: [], deadline: nextDeadline },
        effects: [
          { kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: nextDeadline },
          { kind: EffectKind.BROADCAST },
        ],
      };
    }
    // DONE — terminal, nothing to do.
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const q = currentQuestion(state);
    const base: ViewPatch = { phase: state.phase, qIndex: state.qIndex, prompt: q?.prompt ?? null };
    // answer secrecy: target only revealed at REVEAL, and never to a non-display audience early.
    if (state.phase === Phase.REVEAL && q) base.target = q.target;
    if (audience.kind === AudienceKind.PLAYER) {
      base.answered = state.answers.some((a) => a.playerId === audience.playerId);
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const q = currentQuestion(state);
    if (!q) return { deltas: [], maxPoints: 0 };
    const maxPoints = 100;
    // Closest answer scores most; ties allowed. Simple, deterministic.
    const deltas = state.answers.map((a) => {
      const distance = Math.abs(a.value - q.target);
      const points = Math.max(0, maxPoints - distance);
      return { playerId: a.playerId, points, reason: MESSAGE_KEYS.common.OK };
    });
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
