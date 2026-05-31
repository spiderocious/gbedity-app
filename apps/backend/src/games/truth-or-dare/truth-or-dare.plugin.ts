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

// Truth or Dare (PRD §6.3 #13) — round-robin. The active player picks Truth or Dare; a
// rating-filtered prompt shows on the display; OTHERS vote whether they completed it. Points for
// completion (per the threshold), bonus for choosing Dare. Composes round-robin (Word Bomb) + vote
// (Hot Take). Content: rating-filtered truth + dare prompt pools (resolved server-side).

const Phase = { CHOOSE: 'choose', VOTE: 'vote', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const Choice = { TRUTH: 'truth', DARE: 'dare' } as const;
type Choice = (typeof Choice)[keyof typeof Choice];
const ActionType = { CHOOSE: 'truth_or_dare.choose', VOTE: 'truth_or_dare.vote' } as const;
const Threshold = { MAJORITY: 'majority', UNANIMOUS: 'unanimous', ANY: 'any' } as const;
type Threshold = (typeof Threshold)[keyof typeof Threshold];
const TimerKey = { TURN: 'turn' } as const;
const EventType = { CHOOSE: 'truth_or_dare.choose', VOTE: 'truth_or_dare.vote' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(3), // full rotations
  chooseSeconds: z.number().int().positive().default(20),
  voteSeconds: z.number().int().positive().default(20),
  threshold: z.nativeEnum(Threshold).default(Threshold.MAJORITY),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ truths: z.array(z.string().min(1)).min(1), dares: z.array(z.string().min(1)).min(1) });
type Content = z.infer<typeof contentSchema>;

const chooseAction = z.object({ type: z.literal(ActionType.CHOOSE), choice: z.nativeEnum(Choice) });
const voteAction = z.object({ type: z.literal(ActionType.VOTE), completed: z.boolean() });
const actionSchema = z.discriminatedUnion('type', [chooseAction, voteAction]);
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  round: number;
  rounds: number;
  chooseSeconds: number;
  voteSeconds: number;
  threshold: Threshold;
  order: string[];
  turnIdx: number;
  truths: string[];
  dares: string[];
  promptIdx: number; // which prompt of the chosen pool
  choice: Choice | null;
  prompt: string | null;
  votes: { voterId: string; completed: boolean }[];
  deadline: EpochMs;
  scores: Record<string, number>;
}

const holder = (s: State): string | undefined => s.order[s.turnIdx];

export const truthOrDareGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.TRUTH_OR_DARE,
    title: 'Truth or Dare',
    category: GameCategory.PARTY,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 2, max: 12, recommendedMax: 12 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const d = input.startedAt + input.config.chooseSeconds * 1000;
    return {
      state: {
        phase: Phase.CHOOSE,
        round: 0,
        rounds: input.config.rounds,
        chooseSeconds: input.config.chooseSeconds,
        voteSeconds: input.config.voteSeconds,
        threshold: input.config.threshold,
        order: input.players.map((p: PlayerRef) => p.id),
        turnIdx: 0,
        truths: input.content.truths,
        dares: input.content.dares,
        promptIdx: 0,
        choice: null,
        prompt: null,
        votes: [],
        deadline: d,
        scores: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };

    if (action.type === ActionType.CHOOSE) {
      if (state.phase !== Phase.CHOOSE || holder(state) !== ctx.actor.id) return { state, effects: [] };
      const pool = action.choice === Choice.TRUTH ? state.truths : state.dares;
      const idx = state.promptIdx % pool.length;
      const prompt = pool[idx] ?? '…';
      const d = ctx.now + state.voteSeconds * 1000;
      return {
        state: { ...state, phase: Phase.VOTE, choice: action.choice, prompt, deadline: d },
        effects: [
          { kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d },
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.CHOOSE, data: { choice: action.choice } } },
        ],
      };
    }

    // VOTE — everyone except the active player votes completed/not.
    if (state.phase !== Phase.VOTE || holder(state) === ctx.actor.id) return { state, effects: [] };
    if (state.votes.some((v) => v.voterId === ctx.actor.id)) return { state, effects: [] };
    return {
      state: { ...state, votes: [...state.votes, { voterId: ctx.actor.id, completed: action.completed }] },
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.VOTE, data: {} } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.CHOOSE) {
      // active player didn't choose → skip their turn (no score), advance.
      return advance(state, nowMs);
    }
    if (state.phase === Phase.VOTE) {
      return advance(scoreTurn(state), nowMs);
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const base: ViewPatch = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      holderId: holder(state) ?? null,
      choice: state.choice,
      prompt: state.phase === Phase.VOTE ? state.prompt : null,
    };
    if (audience.kind === AudienceKind.PLAYER) {
      base.yourTurn = holder(state) === audience.playerId;
      base.canVote = state.phase === Phase.VOTE && holder(state) !== audience.playerId;
      base.voted = state.votes.some((v) => v.voterId === audience.playerId);
      base.yourScore = state.scores[audience.playerId] ?? 0;
    }
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

// Tally votes against the threshold; award the active player on "completed", with a Dare bonus.
const scoreTurn = (state: State): State => {
  const pid = holder(state);
  if (!pid) return state;
  const yes = state.votes.filter((v) => v.completed).length;
  const total = state.votes.length;
  const passed =
    state.threshold === Threshold.ANY ? yes >= 1 : state.threshold === Threshold.UNANIMOUS ? total > 0 && yes === total : yes * 2 > total;
  const scores = { ...state.scores };
  if (passed) scores[pid] = (scores[pid] ?? 0) + (state.choice === Choice.DARE ? 150 : 100);
  return { ...state, scores };
};

// Advance to the next player's CHOOSE; after a full rotation, increment round; after `rounds`, done.
const advance = (state: State, nowMs: EpochMs): StepResult<State> => {
  const nextIdx = state.turnIdx + 1;
  const wrapped = nextIdx >= state.order.length;
  const nextRound = wrapped ? state.round + 1 : state.round;
  if (wrapped && nextRound >= state.rounds) {
    return {
      state: { ...state, phase: Phase.DONE },
      effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.GAME_ENDED }],
    };
  }
  const d = nowMs + state.chooseSeconds * 1000;
  return {
    state: {
      ...state,
      phase: Phase.CHOOSE,
      round: nextRound,
      turnIdx: wrapped ? 0 : nextIdx,
      choice: null,
      prompt: null,
      votes: [],
      promptIdx: state.promptIdx + 1,
      deadline: d,
    },
    effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN }, { kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d }, { kind: EffectKind.BROADCAST }],
  };
};
