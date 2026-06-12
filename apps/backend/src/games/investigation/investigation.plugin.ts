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

import { projectBoard, projectTiming } from '../shared/view-helpers';

// Investigation (PRD §6.4 #17) — OPEN_PHASE mode. A case is shown; players freely explore the case
// materials (brief, suspects, evidence, timeline) on their phones at their own pace within a time
// window, then privately submit an accusation (a suspect id). When the window closes the truth is
// revealed; correct accusers score, bonus for the fastest correct. The guilty suspect is
// SERVER-ONLY until reveal.

const Phase = { INVESTIGATE: 'investigate', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { ACCUSE: 'investigation.accuse' } as const;
const TimerKey = { INVESTIGATE: 'investigate', REVEAL: 'reveal' } as const;
const EventType = { ACCUSE: 'investigation.accuse' } as const;

const configSchema = z.object({
  investigateSeconds: z.number().int().positive().default(300), // 5 min default (PRD: 15/30/45/60)
  revealSeconds: z.number().int().positive().default(10),
});
type Config = z.infer<typeof configSchema>;

const suspect = z.object({ id: z.string(), name: z.string(), profile: z.string() });
const evidence = z.object({ id: z.string(), label: z.string(), detail: z.string() });
const contentSchema = z.object({
  title: z.string(),
  brief: z.string(),
  suspects: z.array(suspect).min(2),
  evidence: z.array(evidence).min(1),
  timeline: z.array(z.string()).default([]),
  solutionSuspectId: z.string(),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.ACCUSE), suspectId: z.string() });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  case: Content;
  revealSeconds: number;
  deadline: EpochMs;
  startedAt: EpochMs;
  investigateSeconds: number;
  accusations: { playerId: string; suspectId: string; at: EpochMs }[];
}

// Final points per player — correct accusers score, fastest gets a bonus. Single source for the
// reveal board AND scoreRound.
const scoreMap = (state: State): Record<string, number> => {
  const solution = state.case.solutionSuspectId;
  const correct = state.accusations.filter((a) => a.suspectId === solution).sort((a, b) => a.at - b.at);
  const out: Record<string, number> = {};
  correct.forEach((a, rank) => {
    out[a.playerId] = rank === 0 ? 1000 : 600;
  });
  return out;
};

export const investigationGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.INVESTIGATION,
    title: 'Investigation',
    category: GameCategory.IMMERSIVE,
    mode: GameMode.OPEN_PHASE,
    players: { min: 2, max: 8, recommendedMax: 8 },
    capabilities: {},
    // Solo-able: each player investigates + accuses independently and is scored against the
    // revealed truth — no peer dependency (SP-4: was excluded only by oversight).
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const d = input.startedAt + input.config.investigateSeconds * 1000;
    return {
      state: {
        phase: Phase.INVESTIGATE,
        case: input.content,
        revealSeconds: input.config.revealSeconds,
        deadline: d,
        startedAt: input.startedAt,
        investigateSeconds: input.config.investigateSeconds,
        accusations: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.INVESTIGATE, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.INVESTIGATE) return { state, effects: [] };
    // a player may change their accusation until the window closes (latest wins)
    if (!state.case.suspects.some((s) => s.id === action.suspectId)) return { state, effects: [] };
    const accusations = [...state.accusations.filter((a) => a.playerId !== ctx.actor.id), { playerId: ctx.actor.id, suspectId: action.suspectId, at: ctx.now }];
    return {
      state: { ...state, accusations },
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.ACCUSE, data: {} } }],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.INVESTIGATE) {
      const d = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const c = state.case;
    // Case materials are served to everyone (the players explore them); the SOLUTION is withheld
    // until reveal.
    const base: ViewPatch = {
      phase: state.phase,
      title: c.title,
      brief: c.brief,
      suspects: c.suspects,
      evidence: c.evidence,
      timeline: c.timeline,
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, state.phase === Phase.REVEAL ? state.revealSeconds : state.investigateSeconds),
    };
    if (state.phase === Phase.REVEAL) {
      base.solutionSuspectId = c.solutionSuspectId;
      base.accusations = state.accusations.map((a) => ({ playerId: a.playerId, suspectId: a.suspectId }));
      // The board only becomes meaningful once the truth is out (correct accusers score).
      const final = scoreMap(state);
      base.board = projectBoard(final, final);
    }
    if (audience.kind === AudienceKind.PLAYER) {
      base.yourAccusation = state.accusations.find((a) => a.playerId === audience.playerId)?.suspectId ?? null;
      if (state.phase === Phase.REVEAL) base.yourScore = scoreMap(state)[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(scoreMap(state)).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    return { deltas, maxPoints: 1000 };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
