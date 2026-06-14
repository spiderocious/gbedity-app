import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import { AudienceKind, EffectKind, GameCategory, GameId, GameMode, SystemActionType } from '@engine/constants';
import type {
  ActionCtx,
  Audience,
  GamePlugin,
  InitInput,
  PlayerRef,
  RoundScore,
  ServiceResultAction,
  StepResult,
  TickCtx,
  ViewPatch,
} from '@engine/types';

import { projectBoard, projectTiming } from '../shared/view-helpers';

// Millionaire (PRD §6.2 #12) — graduated MCQ ladder, ROTATIONAL turns. Correct → bank the rung's
// value + advance the ladder + next player; wrong → that player is eliminated. Time-boxed by
// questions. Lifelines: 50/50 (hide two wrong options), Ask-the-Audience (NESTED simultaneous poll
// of the other players, tally shown), Phone-a-Friend (defer to a chosen playing friend whose
// suggested answer is shown to the holder as advice — the holder still answers).

const Phase = { TURN_INTRO: 'turn_intro', QUESTION: 'question', AUDIENCE_POLL: 'audience_poll', PHONE_WAIT: 'phone_wait', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = {
  ANSWER: 'millionaire.answer',
  LIFELINE: 'millionaire.lifeline', // { lifeline, friendId? }
  AUDIENCE_VOTE: 'millionaire.audience_vote', // { choiceIdx } during AUDIENCE_POLL
  PHONE_SUGGEST: 'millionaire.phone_suggest', // { choiceIdx } the friend's advice during PHONE_WAIT
} as const;
const Lifeline = { FIFTY_FIFTY: 'fifty_fifty', ASK_AUDIENCE: 'ask_audience', PHONE_FRIEND: 'phone_friend' } as const;
type Lifeline = (typeof Lifeline)[keyof typeof Lifeline];
const TimerKey = { TURN_INTRO: 'turn_intro', QUESTION: 'question', POLL: 'poll', PHONE: 'phone', REVEAL: 'reveal' } as const;
const EventType = { ANSWER: 'millionaire.answer', LIFELINE: 'millionaire.lifeline' } as const;

const LADDER = [100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

const configSchema = z.object({
  timePerQuestion: z.number().int().positive().default(30),
  pollSeconds: z.number().int().positive().default(15),
  phoneSeconds: z.number().int().positive().default(15),
  revealSeconds: z.number().int().positive().default(4),
  questionCount: z.number().int().positive().default(15),
  lifelines: z.array(z.nativeEnum(Lifeline)).default([Lifeline.FIFTY_FIFTY, Lifeline.ASK_AUDIENCE, Lifeline.PHONE_FRIEND]),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()).length(4), answerIdx: z.number().int().min(0).max(3) })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const answerA = z.object({ type: z.literal(ActionType.ANSWER), choiceIdx: z.number().int().min(0).max(3) });
const lifelineA = z.object({ type: z.literal(ActionType.LIFELINE), lifeline: z.nativeEnum(Lifeline), friendId: z.string().optional() });
const audienceVoteA = z.object({ type: z.literal(ActionType.AUDIENCE_VOTE), choiceIdx: z.number().int().min(0).max(3) });
const phoneSuggestA = z.object({ type: z.literal(ActionType.PHONE_SUGGEST), choiceIdx: z.number().int().min(0).max(3) });
const actionSchema = z.discriminatedUnion('type', [answerA, lifelineA, audienceVoteA, phoneSuggestA]);
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  order: string[]; // rotation
  turnIdx: number; // whose question it is
  eliminated: string[];
  qIndex: number; // question / ladder rung
  questionCount: number;
  timePerQuestion: number;
  pollSeconds: number;
  phoneSeconds: number;
  revealSeconds: number;
  lifelines: Lifeline[];
  questions: Content['questions'];
  deadline: EpochMs;
  hiddenOptions: number[]; // 50/50 result for the current question
  usedLifelines: Record<string, Lifeline[]>; // per player
  audienceVotes: { voterId: string; choiceIdx: number }[];
  phoneFriendId: string | null;
  phoneSuggestion: number | null;
  banked: Record<string, number>; // winnings
  lastCorrect: boolean | null;
}

const holder = (s: State): string | undefined => s.order[s.turnIdx];
const curQ = (s: State): Content['questions'][number] | undefined => s.questions[s.qIndex];
const rungValue = (i: number): number => LADDER[Math.min(i, LADDER.length - 1)] ?? 0;

// next non-eliminated player after turnIdx
const nextActive = (s: State): number => {
  for (let step = 1; step <= s.order.length; step += 1) {
    const idx = (s.turnIdx + step) % s.order.length;
    if (!s.eliminated.includes(s.order[idx] ?? '')) return idx;
  }
  return -1; // none left
};

export const millionaireGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.MILLIONAIRE,
    title: 'Who Wants to Be a Millionaire',
    category: GameCategory.BRAIN,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 2, max: 10, recommendedMax: 10 },
    capabilities: {},
    solo: { supported: true, disabledConfig: ['ask_audience', 'phone_friend'] },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const order = input.players.map((p: PlayerRef) => p.id);
    const d = input.startedAt + 4000;
    return {
      state: {
        phase: Phase.TURN_INTRO,
        order,
        turnIdx: 0,
        eliminated: [],
        qIndex: 0,
        questionCount: Math.min(input.config.questionCount, input.content.questions.length),
        timePerQuestion: input.config.timePerQuestion,
        pollSeconds: input.config.pollSeconds,
        phoneSeconds: input.config.phoneSeconds,
        revealSeconds: input.config.revealSeconds,
        lifelines: input.config.lifelines,
        questions: input.content.questions,
        deadline: d,
        hiddenOptions: [],
        usedLifelines: Object.fromEntries(order.map((id) => [id, []])),
        audienceVotes: [],
        phoneFriendId: null,
        phoneSuggestion: null,
        banked: Object.fromEntries(order.map((id) => [id, 0])),
        lastCorrect: null,
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.TURN_INTRO, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };

    // Audience vote — any non-holder, during the poll.
    if (action.type === ActionType.AUDIENCE_VOTE) {
      if (state.phase !== Phase.AUDIENCE_POLL || holder(state) === ctx.actor.id) return { state, effects: [] };
      if (state.audienceVotes.some((v) => v.voterId === ctx.actor.id)) return { state, effects: [] };
      return { state: { ...state, audienceVotes: [...state.audienceVotes, { voterId: ctx.actor.id, choiceIdx: action.choiceIdx }] }, effects: [{ kind: EffectKind.BROADCAST }] };
    }

    // Phone friend's suggestion — only the chosen friend, during the wait.
    if (action.type === ActionType.PHONE_SUGGEST) {
      if (state.phase !== Phase.PHONE_WAIT || state.phoneFriendId !== ctx.actor.id) return { state, effects: [] };
      const d = ctx.now + state.timePerQuestion * 1000;
      return {
        state: { ...state, phase: Phase.QUESTION, phoneSuggestion: action.choiceIdx, deadline: d },
        effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.PHONE }, { kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: d }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.TO_PLAYER, playerId: holder(state) ?? '' }],
      };
    }

    // Lifeline — only the holder, only during their question, only if enabled + unused.
    if (action.type === ActionType.LIFELINE) {
      if (state.phase !== Phase.QUESTION || holder(state) !== ctx.actor.id) return { state, effects: [] };
      if (!state.lifelines.includes(action.lifeline)) return { state, effects: [] };
      if ((state.usedLifelines[ctx.actor.id] ?? []).includes(action.lifeline)) return { state, effects: [] };
      const used = { ...state.usedLifelines, [ctx.actor.id]: [...(state.usedLifelines[ctx.actor.id] ?? []), action.lifeline] };
      const q = curQ(state);
      if (!q) return { state, effects: [] };

      if (action.lifeline === Lifeline.FIFTY_FIFTY) {
        // hide two wrong options
        const wrong = [0, 1, 2, 3].filter((i) => i !== q.answerIdx);
        const hidden = wrong.slice(0, 2);
        return { state: { ...state, usedLifelines: used, hiddenOptions: hidden }, effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.LIFELINE, data: { lifeline: action.lifeline } } }] };
      }
      if (action.lifeline === Lifeline.ASK_AUDIENCE) {
        const d = ctx.now + state.pollSeconds * 1000;
        return { state: { ...state, usedLifelines: used, phase: Phase.AUDIENCE_POLL, audienceVotes: [], deadline: d }, effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.QUESTION }, { kind: EffectKind.START_TIMER, key: TimerKey.POLL, fireAt: d }, { kind: EffectKind.BROADCAST }] };
      }
      // PHONE_FRIEND — defer to a chosen, still-playing friend for a suggestion.
      const friendId = action.friendId;
      if (!friendId || friendId === ctx.actor.id || !state.order.includes(friendId) || state.eliminated.includes(friendId)) return { state, effects: [] };
      const d = ctx.now + state.phoneSeconds * 1000;
      return { state: { ...state, usedLifelines: used, phase: Phase.PHONE_WAIT, phoneFriendId: friendId, phoneSuggestion: null, deadline: d }, effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.QUESTION }, { kind: EffectKind.START_TIMER, key: TimerKey.PHONE, fireAt: d }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.TO_PLAYER, playerId: friendId }] };
    }

    // ANSWER — only the holder, during their question.
    if (state.phase !== Phase.QUESTION || holder(state) !== ctx.actor.id) return { state, effects: [] };
    const q = curQ(state);
    if (!q) return { state, effects: [] };
    const correct = action.choiceIdx === q.answerIdx;
    const banked = { ...state.banked };
    if (correct) banked[ctx.actor.id] = (banked[ctx.actor.id] ?? 0) + rungValue(state.qIndex);
    const d = ctx.now + state.revealSeconds * 1000;
    return {
      state: { ...state, phase: Phase.REVEAL, banked, lastCorrect: correct, deadline: d },
      effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.QUESTION }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.ANSWER, data: { qIndex: state.qIndex, correct } } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.TURN_INTRO) {
      const d = nowMs + state.timePerQuestion * 1000;
      return { state: { ...state, phase: Phase.QUESTION, deadline: d }, effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: d }, { kind: EffectKind.BROADCAST }] };
    }
    if (state.phase === Phase.QUESTION) {
      // timed out → treat as wrong, reveal (no elimination in MP).
      const d = nowMs + state.revealSeconds * 1000;
      const eliminated = state.eliminated;
      return { state: { ...state, phase: Phase.REVEAL, eliminated, lastCorrect: false, deadline: d }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }] };
    }
    if (state.phase === Phase.AUDIENCE_POLL) {
      // poll closed → back to the holder's question (tally now visible in view).
      const d = nowMs + state.timePerQuestion * 1000;
      return { state: { ...state, phase: Phase.QUESTION, deadline: d }, effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: d }, { kind: EffectKind.BROADCAST }] };
    }
    if (state.phase === Phase.PHONE_WAIT) {
      // friend didn't answer → back to the holder, no suggestion.
      const d = nowMs + state.timePerQuestion * 1000;
      return { state: { ...state, phase: Phase.QUESTION, deadline: d }, effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.QUESTION, fireAt: d }, { kind: EffectKind.BROADCAST }] };
    }
    if (state.phase === Phase.REVEAL) {
      // advance the ladder + rotate to the next active player; end when out of questions.
      const nextQ = state.qIndex + 1;
      const nextTurn = nextActive(state);
      if (nextQ >= state.questionCount) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.GAME_ENDED }] };
      }
      const d = nowMs + 4000;
      return {
        state: { ...state, phase: Phase.TURN_INTRO, qIndex: nextQ, turnIdx: nextTurn === -1 ? 0 : nextTurn, hiddenOptions: [], audienceVotes: [], phoneFriendId: null, phoneSuggestion: null, lastCorrect: null, deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.TURN_INTRO, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const q = curQ(state);
    const base: ViewPatch = {
      phase: state.phase,
      qIndex: state.qIndex,
      rung: rungValue(state.qIndex),
      ladder: LADDER,
      holderId: holder(state) ?? null,
      prompt: q?.prompt ?? null,
      options: q?.options ?? [],
      hiddenOptions: state.hiddenOptions, // 50/50
      eliminated: state.eliminated,
      banked: state.banked,
      revealSeconds: state.revealSeconds,
      questionCount: state.questionCount,
      order: state.order,
      ...projectTiming(state.deadline, state.timePerQuestion),
      board: projectBoard(state.banked),
    };
    if (state.phase === Phase.AUDIENCE_POLL || state.phase === Phase.REVEAL) {
      // audience tally (counts per option) — visible to all incl. the holder for the decision.
      const tally = [0, 0, 0, 0];
      for (const v of state.audienceVotes) tally[v.choiceIdx] = (tally[v.choiceIdx] ?? 0) + 1;
      base.audienceTally = tally;
    }
    if (state.phase === Phase.REVEAL && q) {
      base.answerIdx = q.answerIdx;
      base.lastCorrect = state.lastCorrect;
    }
    if (audience.kind === AudienceKind.PLAYER) {
      base.yourTurn = holder(state) === audience.playerId && (state.phase === Phase.QUESTION || state.phase === Phase.TURN_INTRO);
      base.canVoteAudience = state.phase === Phase.AUDIENCE_POLL && holder(state) !== audience.playerId;
      base.youArePhoned = state.phase === Phase.PHONE_WAIT && state.phoneFriendId === audience.playerId;
      base.lifelinesUsed = state.usedLifelines[audience.playerId] ?? [];
      // the phone suggestion is private to the holder
      if (holder(state) === audience.playerId) base.phoneSuggestion = state.phoneSuggestion;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    // banked winnings are the score. Normalize via maxPoints = top of the ladder × rungs.
    const deltas = Object.entries(state.banked).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    const maxPoints = Math.max(1, ...Object.values(state.banked));
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
