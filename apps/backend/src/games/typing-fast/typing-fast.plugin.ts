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

import { accrue, projectBoard, projectTiming } from '../shared/view-helpers';

// Typing Fast (PRD §6.1 #4) — a passage on display; players type it; score = WPM × accuracy
// (accuracyWeight slides speed↔accuracy). Pure in-plugin scoring (no validation service). Players
// submit their typed text (the client may send the final text on done or on timeout).

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { SUBMIT: 'typing_fast.submit' } as const;
const TimerKey = { ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { SUBMIT: 'typing_fast.submit' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(3),
  secondsPerPassage: z.number().int().positive().default(60),
  revealSeconds: z.number().int().positive().default(4),
  accuracyWeight: z.number().min(0).max(100).default(50), // 0 = pure speed, 100 = pure accuracy
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ passages: z.array(z.string().min(1)).min(1) });
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.SUBMIT), text: z.string() });
type Action = z.infer<typeof actionSchema>;

interface Submission {
  playerId: string;
  text: string;
  at: EpochMs;
}

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerPassage: number;
  revealSeconds: number;
  accuracyWeight: number;
  passages: string[];
  roundStartedAt: EpochMs;
  deadline: EpochMs;
  submissions: Submission[];
  totals: Record<string, number>; // cumulative score per player (board)
  lastDeltas: Record<string, number>; // this round's points per player (board roundDelta + scoreRound)
}

const POINTS = 1000;
const cur = (s: State): string | undefined => s.passages[s.idx];

// Character-level accuracy: fraction of target characters typed correctly in position.
const accuracy = (typed: string, target: string): number => {
  if (target.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < target.length; i += 1) if (typed[i] === target[i]) correct += 1;
  return correct / target.length;
};

// This round's points per player — single source for the in-patch board AND scoreRound (WPM×accuracy).
const roundDeltasMap = (state: State): Record<string, number> => {
  const target = cur(state) ?? '';
  const aw = state.accuracyWeight / 100;
  const out: Record<string, number> = {};
  for (const s of state.submissions) {
    const acc = accuracy(s.text, target);
    const minutes = Math.max(0.001, (s.at - state.roundStartedAt) / 60000);
    const wpm = s.text.trim().split(/\s+/).filter(Boolean).length / minutes;
    const speedScore = Math.min(1, wpm / 80);
    const combined = aw * acc + (1 - aw) * speedScore;
    out[s.playerId] = Math.round(POINTS * combined);
  }
  return out;
};

export const typingFastGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.TYPING_FAST,
    title: 'Typing Fast',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 12 },
    capabilities: {},
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.passages.length);
    const d = input.startedAt + input.config.secondsPerPassage * 1000;
    return {
      state: {
        phase: Phase.ROUND,
        idx: 0,
        rounds,
        secondsPerPassage: input.config.secondsPerPassage,
        revealSeconds: input.config.revealSeconds,
        accuracyWeight: input.config.accuracyWeight,
        passages: input.content.passages,
        roundStartedAt: input.startedAt,
        deadline: d,
        submissions: [],
        totals: Object.fromEntries(input.players.map((p) => [p.id, 0])),
        lastDeltas: {},
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    // keep the player's latest submission (they may submit progress; final wins)
    const submissions = [...state.submissions.filter((s) => s.playerId !== ctx.actor.id), { playerId: ctx.actor.id, text: action.text, at: ctx.now }];
    return {
      state: { ...state, submissions },
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SUBMIT, data: { idx: state.idx } } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.ROUND) {
      const d = nowMs + state.revealSeconds * 1000;
      const deltas = roundDeltasMap(state);
      const totals = accrue(state.totals, deltas);
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d, totals, lastDeltas: deltas },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      const next = state.idx + 1;
      if (next >= state.rounds) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
      const d = nowMs + state.secondsPerPassage * 1000;
      return {
        state: { ...state, phase: Phase.ROUND, idx: next, roundStartedAt: nowMs, submissions: [], deadline: d, lastDeltas: {} },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const passage = cur(state);
    const base: ViewPatch = {
      phase: state.phase,
      idx: state.idx,
      rounds: state.rounds,
      passage: passage ?? null,
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, state.secondsPerPassage),
      board: projectBoard(state.totals, state.lastDeltas),
    };
    if (audience.kind === AudienceKind.PLAYER) {
      base.submitted = state.submissions.some((s) => s.playerId === audience.playerId);
      base.yourScore = state.totals[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(state.lastDeltas).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    return { deltas, maxPoints: POINTS };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
