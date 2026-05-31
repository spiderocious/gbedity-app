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

// Presentation (PRD §6.4 #19) — round-robin. Each player presents a topic aloud (no prep) while the
// topic shows on the display; OTHERS rate across criteria (persuasiveness/entertainment/confidence
// 1–5 sliders) + an optional heckle. Score = aggregate ratings (+ audience-favourite bonus).
// New mechanic: multi-criteria rating (N raters × M criteria), beyond the single-pick vote.

const Phase = { PRESENT: 'present', RATE: 'rate', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { RATE: 'presentation.rate', HECKLE: 'presentation.heckle' } as const;
const TimerKey = { TURN: 'turn' } as const;
const EventType = { RATE: 'presentation.rate' } as const;

const CRITERIA = ['persuasiveness', 'entertainment', 'confidence'] as const;
type Criterion = (typeof CRITERIA)[number];

const configSchema = z.object({
  rounds: z.number().int().positive().default(1), // rotations
  presentationSeconds: z.number().int().positive().default(90),
  rateSeconds: z.number().int().positive().default(20),
  allowHeckle: z.boolean().default(true),
  audienceBonus: z.boolean().default(true),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ topics: z.array(z.string().min(1)).min(1) });
type Content = z.infer<typeof contentSchema>;

const ratingShape = z.object({ persuasiveness: z.number().int().min(1).max(5), entertainment: z.number().int().min(1).max(5), confidence: z.number().int().min(1).max(5) });
const rateAction = z.object({ type: z.literal(ActionType.RATE), ratings: ratingShape });
const heckleAction = z.object({ type: z.literal(ActionType.HECKLE), text: z.string().min(1) });
const actionSchema = z.discriminatedUnion('type', [rateAction, heckleAction]);
type Action = z.infer<typeof actionSchema>;

interface Rating {
  raterId: string;
  values: Record<Criterion, number>;
}

interface State {
  phase: Phase;
  round: number;
  rounds: number;
  presentationSeconds: number;
  rateSeconds: number;
  allowHeckle: boolean;
  audienceBonus: boolean;
  order: string[];
  turnIdx: number;
  topics: string[];
  topicIdx: number;
  deadline: EpochMs;
  ratings: Rating[]; // for the current presenter
  heckles: string[];
  scores: Record<string, number>;
}

const presenter = (s: State): string | undefined => s.order[s.turnIdx];
const topic = (s: State): string => s.topics[s.topicIdx % s.topics.length] ?? '';

export const presentationGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.PRESENTATION,
    title: 'Presentation',
    category: GameCategory.IMMERSIVE,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 2, max: 10, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const d = input.startedAt + input.config.presentationSeconds * 1000;
    return {
      state: {
        phase: Phase.PRESENT,
        round: 0,
        rounds: input.config.rounds,
        presentationSeconds: input.config.presentationSeconds,
        rateSeconds: input.config.rateSeconds,
        allowHeckle: input.config.allowHeckle,
        audienceBonus: input.config.audienceBonus,
        order: input.players.map((p: PlayerRef) => p.id),
        turnIdx: 0,
        topics: input.content.topics,
        topicIdx: 0,
        deadline: d,
        ratings: [],
        heckles: [],
        scores: Object.fromEntries(input.players.map((p) => [p.id, 0])),
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };

    if (action.type === ActionType.HECKLE) {
      if (!state.allowHeckle || state.phase === Phase.DONE || presenter(state) === ctx.actor.id) return { state, effects: [] };
      return { state: { ...state, heckles: [...state.heckles, action.text] }, effects: [{ kind: EffectKind.BROADCAST }] };
    }

    // RATE — only during the rate phase, not the presenter, one rating per rater.
    if (state.phase !== Phase.RATE || presenter(state) === ctx.actor.id) return { state, effects: [] };
    if (state.ratings.some((r) => r.raterId === ctx.actor.id)) return { state, effects: [] };
    return {
      state: { ...state, ratings: [...state.ratings, { raterId: ctx.actor.id, values: action.ratings }] },
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.RATE, data: {} } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.PRESENT) {
      const d = nowMs + state.rateSeconds * 1000;
      return { state: { ...state, phase: Phase.RATE, deadline: d }, effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d }, { kind: EffectKind.BROADCAST }] };
    }
    if (state.phase === Phase.RATE) {
      const scored = scorePresenter(state);
      return advance(scored, nowMs);
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const base: ViewPatch = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      presenterId: presenter(state) ?? null,
      topic: topic(state),
      heckles: state.heckles,
    };
    if (audience.kind === AudienceKind.PLAYER) {
      base.youArePresenting = presenter(state) === audience.playerId;
      base.canRate = state.phase === Phase.RATE && presenter(state) !== audience.playerId;
      base.rated = state.ratings.some((r) => r.raterId === audience.playerId);
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

// Average each criterion across raters (1–5), sum the criteria → presenter's points this turn.
const scorePresenter = (state: State): State => {
  const pid = presenter(state);
  if (!pid || state.ratings.length === 0) return state;
  let total = 0;
  for (const c of CRITERIA) {
    const avg = state.ratings.reduce((sum, r) => sum + r.values[c], 0) / state.ratings.length;
    total += avg; // each criterion contributes its 1–5 average
  }
  const scores = { ...state.scores };
  scores[pid] = (scores[pid] ?? 0) + Math.round(total * 10); // scale to a nicer range
  return { ...state, scores };
};

const advance = (state: State, nowMs: EpochMs): StepResult<State> => {
  const nextIdx = state.turnIdx + 1;
  const wrapped = nextIdx >= state.order.length;
  const nextRound = wrapped ? state.round + 1 : state.round;
  if (wrapped && nextRound >= state.rounds) {
    return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN }, { kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.GAME_ENDED }] };
  }
  const d = nowMs + state.presentationSeconds * 1000;
  return {
    state: { ...state, phase: Phase.PRESENT, round: nextRound, turnIdx: wrapped ? 0 : nextIdx, topicIdx: state.topicIdx + 1, ratings: [], heckles: [], deadline: d },
    effects: [{ kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN }, { kind: EffectKind.START_TIMER, key: TimerKey.TURN, fireAt: d }, { kind: EffectKind.BROADCAST }],
  };
};
