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

// Hot Take Court (PRD §6.3 #16) — submit a one-line defence to a (rating-filtered) prompt, then
// vote anonymously for the most convincing. Always-vote (Q-final). Integrity: defence authorship is
// SERVER-ONLY (never in player/display views); only rating-filtered prompts are served.

const Phase = { SUBMISSION: 'submission', VOTING: 'voting', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = { SUBMIT: 'hot_take.submit', VOTE: 'hot_take.vote' } as const;
const TimerKey = { SUBMISSION: 'submission', VOTING: 'voting', REVEAL: 'reveal' } as const;
const EventType = { SUBMIT: 'hot_take.submit', VOTE: 'hot_take.vote' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(5),
  submissionSeconds: z.number().int().positive().default(60),
  votingSeconds: z.number().int().positive().default(45),
  revealSeconds: z.number().int().positive().default(5),
  // When false, the reveal tally attributes each defence to its author's nickname (BUG-D wired).
  // Default true = anonymous (defences never carry authorship to player/display views).
  anonymousVoting: z.boolean().default(true),
  // funniest bonus round (a 2nd vote axis) — config accepted, behaviour DEFERRED (no-op for now).
  funniestBonusRound: z.boolean().default(true),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ prompts: z.array(z.string()).min(1) });
type Content = z.infer<typeof contentSchema>;

const submitAction = z.object({ type: z.literal(ActionType.SUBMIT), text: z.string().min(1) });
const voteAction = z.object({ type: z.literal(ActionType.VOTE), defenceId: z.string() });
const actionSchema = z.discriminatedUnion('type', [submitAction, voteAction]);
type Action = z.infer<typeof actionSchema>;

interface Defence {
  id: string; // anonymous label e.g. "d1"
  playerId: string; // SERVER-ONLY — never projected to player/display unless anonymousVoting=false at reveal
  text: string;
}

interface State {
  phase: Phase;
  roundIndex: number;
  rounds: number;
  submissionSeconds: number;
  votingSeconds: number;
  revealSeconds: number;
  anonymousVoting: boolean;
  prompts: string[];
  deadline: EpochMs;
  defences: Defence[];
  votes: { voterId: string; defenceId: string }[];
  nicknames: Record<string, string>; // playerId → nickname (server-only; revealed only if not anonymous)
  scores: Record<string, number>;
}

const prompt = (s: State): string => s.prompts[s.roundIndex % s.prompts.length] ?? '';

export const hotTakeCourtGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.HOT_TAKE_COURT,
    title: 'Hot Take Court',
    category: GameCategory.PARTY,
    mode: GameMode.SUBMIT_VOTE,
    players: { min: 3, max: 15, recommendedMax: 15 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const deadline = input.startedAt + input.config.submissionSeconds * 1000;
    return {
      state: {
        phase: Phase.SUBMISSION,
        roundIndex: 0,
        rounds: input.config.rounds,
        submissionSeconds: input.config.submissionSeconds,
        votingSeconds: input.config.votingSeconds,
        revealSeconds: input.config.revealSeconds,
        anonymousVoting: input.config.anonymousVoting,
        prompts: input.content.prompts,
        deadline,
        defences: [],
        votes: [],
        nicknames: Object.fromEntries(input.players.map((p) => [p.id, p.nickname])),
        scores: {},
      },
      effects: [
        { kind: EffectKind.START_TIMER, key: TimerKey.SUBMISSION, fireAt: deadline },
        { kind: EffectKind.BROADCAST },
      ],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };

    if (action.type === ActionType.SUBMIT) {
      if (state.phase !== Phase.SUBMISSION) return { state, effects: [] };
      if (state.defences.some((d) => d.playerId === ctx.actor.id)) return { state, effects: [] };
      const defence: Defence = { id: `d${state.defences.length + 1}`, playerId: ctx.actor.id, text: action.text };
      return {
        state: { ...state, defences: [...state.defences, defence] },
        effects: [
          { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
          { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: { roundIndex: state.roundIndex } } },
        ],
      };
    }

    // VOTE — voting phase only; one vote per player; cannot vote own defence.
    if (state.phase !== Phase.VOTING) return { state, effects: [] };
    if (state.votes.some((v) => v.voterId === ctx.actor.id)) return { state, effects: [] };
    const target = state.defences.find((d) => d.id === action.defenceId);
    if (!target || target.playerId === ctx.actor.id) return { state, effects: [] };
    return {
      state: { ...state, votes: [...state.votes, { voterId: ctx.actor.id, defenceId: action.defenceId }] },
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.VOTE, data: { roundIndex: state.roundIndex } } },
      ],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.SUBMISSION) {
      const deadline = nowMs + state.votingSeconds * 1000;
      return {
        state: { ...state, phase: Phase.VOTING, deadline },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.VOTING, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
      };
    }
    if (state.phase === Phase.VOTING) {
      const deadline = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline },
        effects: [
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.ROUND_ENDED },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: deadline },
        ],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      }
      const deadline = nowMs + state.submissionSeconds * 1000;
      return {
        state: { ...state, phase: Phase.SUBMISSION, roundIndex: nextIndex, defences: [], votes: [], deadline },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.SUBMISSION, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    // ANONYMITY: defences are projected WITHOUT playerId. Tally only shown at reveal.
    const anonDefences = state.defences.map((d) => ({ id: d.id, text: d.text }));
    const base: ViewPatch = {
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      prompt: prompt(state),
      defences: state.phase === Phase.SUBMISSION ? [] : anonDefences,
    };
    if (state.phase === Phase.REVEAL) {
      base.tally = state.defences.map((d) => ({
        id: d.id,
        text: d.text,
        votes: state.votes.filter((v) => v.defenceId === d.id).length,
        // Authorship revealed ONLY when the host disabled anonymous voting (BUG-D). Default anon.
        ...(state.anonymousVoting ? {} : { author: state.nicknames[d.playerId] ?? null }),
      }));
    }
    if (audience.kind === AudienceKind.PLAYER) {
      base.submitted = state.defences.some((d) => d.playerId === audience.playerId);
      base.voted = state.votes.some((v) => v.voterId === audience.playerId);
      base.ownDefenceId = state.defences.find((d) => d.playerId === audience.playerId)?.id ?? null;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = state.defences.map((d) => ({
      playerId: d.playerId,
      points: state.votes.filter((v) => v.defenceId === d.id).length,
      reason: MESSAGE_KEYS.common.OK,
    }));
    const maxPoints = Math.max(1, state.defences.length - 1); // most votes a single defence could get
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
