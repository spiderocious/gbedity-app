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

// Definition Race (PRD §6.1 #9) — a definition shown; players race to type the word being defined.
// Live closeness ranking (like Scrambled Word). The answer word is known to the plugin, so
// closeness is a pure in-plugin computation. Content: { definition, answer } pairs (resolved
// server-side from the `definitions` collection).

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { GUESS: 'definition_race.guess' } as const;
const TimerKey = { ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { GUESS: 'definition_race.guess' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(8),
  secondsPerRound: z.number().int().positive().default(25),
  revealSeconds: z.number().int().positive().default(4),
  rankingDisplayCount: z.number().int().positive().default(5),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  items: z.array(z.object({ definition: z.string().min(1), answer: z.string().min(1) })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.GUESS), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface Guess {
  playerId: string;
  text: string;
  at: EpochMs;
  closeness: number;
  correct: boolean;
}

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  rankingDisplayCount: number;
  items: Content['items'];
  deadline: EpochMs;
  guesses: Guess[];
}

const POINTS = 1000;
const cur = (s: State): Content['items'][number] | undefined => s.items[s.idx];

const closeness = (a: string, b: string): number => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const m: number[][] = Array.from({ length: y.length + 1 }, () => Array<number>(x.length + 1).fill(0));
  for (let i = 0; i <= x.length; i += 1) m[0]![i] = i;
  for (let j = 0; j <= y.length; j += 1) m[j]![0] = j;
  for (let j = 1; j <= y.length; j += 1) {
    for (let i = 1; i <= x.length; i += 1) {
      const c = x[i - 1] === y[j - 1] ? 0 : 1;
      m[j]![i] = Math.min(m[j]![i - 1]! + 1, m[j - 1]![i]! + 1, m[j - 1]![i - 1]! + c);
    }
  }
  const max = Math.max(x.length, y.length);
  return max === 0 ? 1 : 1 - m[y.length]![x.length]! / max;
};

export const definitionRaceGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.DEFINITION_RACE,
    title: 'Definition Race',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.items.length);
    const d = input.startedAt + input.config.secondsPerRound * 1000;
    return {
      state: {
        phase: Phase.ROUND,
        idx: 0,
        rounds,
        secondsPerRound: input.config.secondsPerRound,
        revealSeconds: input.config.revealSeconds,
        rankingDisplayCount: input.config.rankingDisplayCount,
        items: input.content.items,
        deadline: d,
        guesses: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    const item = cur(state);
    if (!item) return { state, effects: [] };
    const text = action.text.trim();
    const c = closeness(text, item.answer);
    const guess: Guess = { playerId: ctx.actor.id, text, at: ctx.now, closeness: c, correct: c >= 1 };
    const guesses = [...state.guesses.filter((g) => g.playerId !== ctx.actor.id), guess];
    return {
      state: { ...state, guesses },
      effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.GUESS, data: { idx: state.idx } } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.ROUND) {
      const d = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const next = state.idx + 1;
      if (next >= state.rounds) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      const d = nowMs + state.secondsPerRound * 1000;
      return {
        state: { ...state, phase: Phase.ROUND, idx: next, guesses: [], deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const item = cur(state);
    const ranked = [...state.guesses]
      .sort((a, b) => b.closeness - a.closeness || a.at - b.at)
      .slice(0, state.rankingDisplayCount)
      .map((g) => ({ text: g.text, closeness: Math.round(g.closeness * 100) }));
    const base: ViewPatch = {
      phase: state.phase,
      idx: state.idx,
      rounds: state.rounds,
      definition: item?.definition ?? null,
      ranked,
    };
    if (state.phase === Phase.REVEAL && item) base.answer = item.answer;
    if (audience.kind === AudienceKind.PLAYER) {
      const own = state.guesses.find((g) => g.playerId === audience.playerId);
      base.yourClosest = own ? Math.round(own.closeness * 100) : null;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = state.guesses.map((g) => ({
      playerId: g.playerId,
      points: g.correct ? POINTS : Math.round(g.closeness * (POINTS * 0.5)),
      reason: MESSAGE_KEYS.common.OK,
    }));
    return { deltas, maxPoints: POINTS };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
