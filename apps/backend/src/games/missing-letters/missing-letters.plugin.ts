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

// Missing Letters (PRD §6.1 #8) — a word with gaps ("B _ N _ N _"); players race to type the full
// word. Exact-match against the known answer (no validation service). Content (word + masked
// positions) resolved server-side from the word DB.

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { GUESS: 'missing_letters.guess' } as const;
const TimerKey = { ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { GUESS: 'missing_letters.guess' } as const;

const configSchema = z.object({
  rounds: z.number().int().positive().default(8),
  secondsPerRound: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
});
type Config = z.infer<typeof configSchema>;

// Each round: the answer + the indices revealed (the rest are blanks).
const contentSchema = z.object({
  words: z.array(z.object({ answer: z.string().min(1), revealed: z.array(z.number().int()) })).min(1),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.GUESS), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  words: Content['words'];
  deadline: EpochMs;
  solved: { playerId: string; at: EpochMs }[]; // correct guessers this round, in order
}

const POINTS = 1000;
const cur = (s: State): Content['words'][number] | undefined => s.words[s.idx];

// Masked display: revealed letters shown, others as "_".
const masked = (w: Content['words'][number]): string =>
  w.answer
    .split('')
    .map((ch, i) => (w.revealed.includes(i) ? ch : '_'))
    .join(' ');

export const missingLettersGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.MISSING_LETTERS,
    title: 'Missing Letters',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 10 },
    capabilities: {},
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const rounds = Math.min(input.config.rounds, input.content.words.length);
    const deadline = input.startedAt + input.config.secondsPerRound * 1000;
    return {
      state: {
        phase: Phase.ROUND,
        idx: 0,
        rounds,
        secondsPerRound: input.config.secondsPerRound,
        revealSeconds: input.config.revealSeconds,
        words: input.content.words,
        deadline,
        solved: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: deadline }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    if (state.solved.some((s) => s.playerId === ctx.actor.id)) return { state, effects: [] };
    const word = cur(state);
    if (!word) return { state, effects: [] };
    if (action.text.trim().toLowerCase() !== word.answer.toLowerCase()) {
      return { state, effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }] }; // wrong: silent retry
    }
    return {
      state: { ...state, solved: [...state.solved, { playerId: ctx.actor.id, at: ctx.now }] },
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.GUESS, data: { idx: state.idx } } },
      ],
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
        state: { ...state, phase: Phase.ROUND, idx: next, solved: [], deadline: d },
        effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
      };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const word = cur(state);
    const base: ViewPatch = {
      phase: state.phase,
      idx: state.idx,
      rounds: state.rounds,
      masked: word ? masked(word) : null,
      length: word?.answer.length ?? 0,
    };
    if (state.phase === Phase.REVEAL && word) base.answer = word.answer; // secrecy: only at reveal
    if (audience.kind === AudienceKind.PLAYER) base.solved = state.solved.some((s) => s.playerId === audience.playerId);
    return base;
  },

  scoreRound(state: State): RoundScore {
    // faster solvers score more (rank order within the round)
    const deltas = state.solved.map((s, rank) => ({
      playerId: s.playerId,
      points: Math.max(100, POINTS - rank * 100),
      reason: MESSAGE_KEYS.common.OK,
    }));
    return { deltas, maxPoints: POINTS };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
