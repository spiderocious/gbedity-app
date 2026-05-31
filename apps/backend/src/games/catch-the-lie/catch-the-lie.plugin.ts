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

// Catch the Lie (PRD §6.3 #14) — each player submits 2 truths + 1 lie about themselves; the display
// reveals one player's 3 statements ANONYMOUSLY (which is the lie is server-only); others vote which
// is the lie; points for guessing correctly + bonus for fooling people. Player-generated content
// (NO platform content). Flow: submit (all) → reveal-each-in-turn + vote → done.

const Phase = { SUBMISSION: 'submission', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { SUBMIT: 'catch_the_lie.submit', VOTE: 'catch_the_lie.vote' } as const;
const TimerKey = { SUBMISSION: 'submission', REVEAL: 'reveal' } as const;
const EventType = { SUBMIT: 'catch_the_lie.submit', VOTE: 'catch_the_lie.vote' } as const;

const configSchema = z.object({
  submissionSeconds: z.number().int().positive().default(120),
  votingSeconds: z.number().int().positive().default(30),
});
type Config = z.infer<typeof configSchema>;

// No platform content — player-generated. Empty content shape.
const contentSchema = z.object({}).strip();
type Content = z.infer<typeof contentSchema>;

const submitAction = z.object({
  type: z.literal(ActionType.SUBMIT),
  statements: z.array(z.string().min(1)).length(3),
  lieIdx: z.number().int().min(0).max(2),
});
const voteAction = z.object({ type: z.literal(ActionType.VOTE), statementIdx: z.number().int().min(0).max(2) });
const actionSchema = z.discriminatedUnion('type', [submitAction, voteAction]);
type Action = z.infer<typeof actionSchema>;

interface Submission {
  playerId: string;
  statements: string[]; // 3
  lieIdx: number; // SERVER-ONLY which is the lie
}

interface State {
  phase: Phase;
  votingSeconds: number;
  submissionSeconds: number;
  order: string[]; // reveal order
  revealIdx: number; // which player is being revealed
  submissions: Submission[];
  votes: { voterId: string; targetPlayerId: string; statementIdx: number }[];
  deadline: EpochMs;
  scores: Record<string, number>;
}

const subjectOf = (s: State): Submission | undefined => {
  const pid = s.order[s.revealIdx];
  return pid ? s.submissions.find((x) => x.playerId === pid) : undefined;
};

export const catchTheLieGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.CATCH_THE_LIE,
    title: 'Catch the Lie',
    category: GameCategory.PARTY,
    mode: GameMode.SUBMIT_REVEAL,
    players: { min: 3, max: 10, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const d = input.startedAt + input.config.submissionSeconds * 1000;
    return {
      state: {
        phase: Phase.SUBMISSION,
        votingSeconds: input.config.votingSeconds,
        submissionSeconds: input.config.submissionSeconds,
        order: input.players.map((p: PlayerRef) => p.id),
        revealIdx: 0,
        submissions: [],
        votes: [],
        deadline: d,
        scores: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.SUBMISSION, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };

    if (action.type === ActionType.SUBMIT) {
      if (state.phase !== Phase.SUBMISSION) return { state, effects: [] };
      if (state.submissions.some((s) => s.playerId === ctx.actor.id)) return { state, effects: [] };
      return {
        state: { ...state, submissions: [...state.submissions, { playerId: ctx.actor.id, statements: action.statements, lieIdx: action.lieIdx }] },
        effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: {} } }],
      };
    }

    // VOTE — only during a reveal; can't vote on your own statements; one vote per subject.
    if (state.phase !== Phase.REVEAL) return { state, effects: [] };
    const subject = subjectOf(state);
    if (!subject || subject.playerId === ctx.actor.id) return { state, effects: [] };
    if (state.votes.some((v) => v.voterId === ctx.actor.id && v.targetPlayerId === subject.playerId)) return { state, effects: [] };
    return {
      state: { ...state, votes: [...state.votes, { voterId: ctx.actor.id, targetPlayerId: subject.playerId, statementIdx: action.statementIdx }] },
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.VOTE, data: {} } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.SUBMISSION) {
      // begin revealing the first player who submitted
      const order = state.submissions.map((s) => s.playerId);
      if (order.length === 0) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      const d = nowMs + state.votingSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, order, revealIdx: 0, deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      // score the just-finished reveal, then advance to the next subject or end.
      const scored = scoreReveal(state);
      const next = state.revealIdx + 1;
      if (next >= state.order.length) {
        return { state: { ...scored, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.GAME_ENDED }] };
      }
      const d = nowMs + state.votingSeconds * 1000;
      return {
        state: { ...scored, revealIdx: next, deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const base: ViewPatch = { phase: state.phase, revealIdx: state.revealIdx, totalSubjects: state.order.length };
    if (state.phase === Phase.REVEAL) {
      const subject = subjectOf(state);
      // statements shown WITHOUT which-is-the-lie. lieIdx is server-only until... we only reveal the
      // tally + correct answer to all once voting closes (kept simple: lie shown at the next tick's
      // score via scores; here we expose statements anonymously).
      base.statements = subject?.statements ?? [];
    }
    if (audience.kind === AudienceKind.PLAYER) {
      base.submitted = state.submissions.some((s) => s.playerId === audience.playerId);
      const subject = subjectOf(state);
      base.isYou = subject?.playerId === audience.playerId;
      base.voted = subject ? state.votes.some((v) => v.voterId === audience.playerId && v.targetPlayerId === subject.playerId) : false;
    }
    base.scores = state.scores;
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(state.scores).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    const maxPoints = Math.max(1, ...Object.values(state.scores));
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};

// Score one reveal: voters who picked the real lie get points; the subject earns bonus per fooled voter.
const scoreReveal = (state: State): State => {
  const subject = subjectOf(state);
  if (!subject) return state;
  const votes = state.votes.filter((v) => v.targetPlayerId === subject.playerId);
  const scores = { ...state.scores };
  let fooled = 0;
  for (const v of votes) {
    if (v.statementIdx === subject.lieIdx) scores[v.voterId] = (scores[v.voterId] ?? 0) + 100; // caught the lie
    else fooled += 1;
  }
  scores[subject.playerId] = (scores[subject.playerId] ?? 0) + fooled * 50; // fooling bonus
  return { ...state, scores };
};
