import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import type { GameId} from '@engine/constants';
import { AudienceKind, EffectKind, GameCategory, GameMode, SystemActionType } from '@engine/constants';
import type {
  ActionCtx,
  AnyGamePlugin,
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

// Shared factory for Synonyms + Antonyms (PRD §6.1 #10/#11) — identical mechanics, opposite
// relation. A prompt word shown; players race to type a valid synonym/antonym; each correct one
// scores; faster scores more. Validation goes to the validation service (mode: 'relation',
// dataset lookup, NO LLM — Q4); verdict re-enters as a synthetic action (§5).

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const configSchema = z.object({
  rounds: z.number().int().positive().default(8),
  secondsPerRound: z.number().int().positive().default(25),
  revealSeconds: z.number().int().positive().default(3),
  answersRequired: z.number().int().positive().default(1), // PRD: keep submitting until count or time
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ words: z.array(z.string().min(1)).min(1) });
type Content = z.infer<typeof contentSchema>;

interface Accepted {
  playerId: string;
  text: string;
  at: EpochMs;
}

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  answersRequired: number;
  words: string[];
  deadline: EpochMs;
  accepted: Accepted[]; // valid answers this round (all players)
  totals: Record<string, number>; // cumulative score per player (board)
  lastDeltas: Record<string, number>; // this round's points per player (board roundDelta + scoreRound)
}

const POINTS = 1000;
const cur = (s: State): string | undefined => s.words[s.idx];

// This round's points per player — single source for the in-patch board AND scoreRound. Earliness
// bonus by acceptance order (same as the original scoreRound).
const roundDeltasMap = (state: State): Record<string, number> => {
  const out: Record<string, number> = {};
  state.accepted.forEach((a, rank) => {
    out[a.playerId] = (out[a.playerId] ?? 0) + Math.max(100, POINTS - rank * 50);
  });
  return out;
};

export interface RelationGameOpts {
  id: typeof GameId.SYNONYMS | typeof GameId.ANTONYMS;
  title: string;
  relation: 'synonyms' | 'antonyms';
  actionType: string;
  eventType: string;
}

// Returns AnyGamePlugin (generics erased) so the concrete games can be exported without leaking the
// module-private State type. The plugin is fully typed internally.
export const makeRelationGame = (opts: RelationGameOpts): AnyGamePlugin => {
  const actionSchema = z.object({ type: z.literal(opts.actionType), text: z.string().min(1) });
  const refFor = (idx: number, playerId: string, n: number): string => `rel_${idx}_${playerId}_${n}`;

  const game: GamePlugin<Config, State, { type: string; text: string }, Content> = {
    manifest: {
      id: opts.id,
      title: opts.title,
      category: GameCategory.QUICK,
      mode: GameMode.SIMULTANEOUS,
      players: { min: 2, max: null, recommendedMax: 10 },
      capabilities: { needsValidation: true },
      solo: { supported: true },
    },
    configSchema,
    contentSchema,
    actionSchema,

    init(input: InitInput<Config, Content>): StepResult<State> {
      const rounds = Math.min(input.config.rounds, input.content.words.length);
      const d = input.startedAt + input.config.secondsPerRound * 1000;
      return {
        state: {
          phase: Phase.ROUND,
          idx: 0,
          rounds,
          secondsPerRound: input.config.secondsPerRound,
          revealSeconds: input.config.revealSeconds,
          answersRequired: input.config.answersRequired,
          words: input.content.words.map((w) => w.toLowerCase()),
          deadline: d,
          accepted: [],
          totals: Object.fromEntries(input.players.map((p) => [p.id, 0])),
          lastDeltas: {},
        },
        effects: [{ kind: EffectKind.START_TIMER, key: 'round', fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    },

    onAction(state, action, ctx: ActionCtx): StepResult<State> {
      if (action.type === SystemActionType.SERVICE_RESULT) {
        const sr = action as ServiceResultAction;
        // ref encodes the player; accept on valid + not already accepted (dup-tolerant via service)
        const parts = sr.ref.split('_');
        const playerId = parts.slice(2, parts.length - 1).join('_');
        const verdict = sr.result as { valid?: boolean } | undefined;
        if (verdict?.valid !== true || state.phase !== Phase.ROUND) return { state, effects: [] };
        return {
          state: { ...state, accepted: [...state.accepted, { playerId, text: '', at: ctx.now }] },
          effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.TO_PLAYER, playerId }],
        };
      }

      // Not a service result → it's the game submit action.
      const submit = action as { type: string; text: string };
      if (state.phase !== Phase.ROUND) return { state, effects: [] };
      const word = cur(state);
      if (!word) return { state, effects: [] };
      const mine = state.accepted.filter((a) => a.playerId === ctx.actor.id).length;
      if (mine >= state.answersRequired) return { state, effects: [] }; // already hit the count
      return {
        state,
        effects: [
          {
            kind: EffectKind.REQUEST_VALIDATION,
            ref: refFor(state.idx, ctx.actor.id, mine),
            payload: {
              mode: 'relation',
              relation: opts.relation,
              promptWord: word,
              guess: submit.text,
              used: state.accepted.filter((a) => a.playerId === ctx.actor.id).map((a) => a.text),
            },
          },
          { kind: EffectKind.PERSIST_EVENT, event: { type: opts.eventType, data: { idx: state.idx } } },
        ],
      };
    },

    onTick(state, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
      if (state.phase === Phase.ROUND) {
        const d = nowMs + state.revealSeconds * 1000;
        const deltas = roundDeltasMap(state);
        const totals = accrue(state.totals, deltas);
        return {
          state: { ...state, phase: Phase.REVEAL, deadline: d, totals, lastDeltas: deltas },
          effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: 'reveal', fireAt: d }],
        };
      }
      if (state.phase === Phase.REVEAL) {
        const next = state.idx + 1;
        if (next >= state.rounds) return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
        const d = nowMs + state.secondsPerRound * 1000;
        return {
          state: { ...state, phase: Phase.ROUND, idx: next, accepted: [], deadline: d, lastDeltas: {} },
          effects: [{ kind: EffectKind.START_TIMER, key: 'round', fireAt: d }, { kind: EffectKind.BROADCAST }],
        };
      }
      return { state, effects: [] };
    },

    view(state, audience: Audience): ViewPatch {
      const base: ViewPatch = {
        phase: state.phase,
        idx: state.idx,
        rounds: state.rounds,
        prompt: cur(state) ?? null,
        relation: opts.relation,
        acceptedCount: state.accepted.length,
        revealSeconds: state.revealSeconds,
        ...projectTiming(state.deadline, state.secondsPerRound),
        board: projectBoard(state.totals, state.lastDeltas),
      };
      if (audience.kind === AudienceKind.PLAYER) {
        base.yourAccepted = state.accepted.filter((a) => a.playerId === audience.playerId).length;
        base.yourScore = state.totals[audience.playerId] ?? 0;
      }
      return base;
    },

    scoreRound(state): RoundScore {
      // Read the deltas captured at ROUND→REVEAL — one source for board + leaderboard.
      const deltas = Object.entries(state.lastDeltas).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
      return { deltas, maxPoints: POINTS };
    },

    isOver(state): boolean {
      return state.phase === Phase.DONE;
    },
  };
  return game as AnyGamePlugin;
};
