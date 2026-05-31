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

// Spelling Fast (PRD §6.1 #3) — a word is READ ALOUD on the display via client-side TTS and NEVER
// shown. Players race to type the correct spelling. Critical secrecy: the word goes to the DISPLAY
// audience only (so the display can speak it); players receive only "speak"/length cues, never the
// word. Exact-match scoring, speed-ranked.

const Phase = { ROUND: 'round', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { SPELL: 'spelling_fast.spell' } as const;
const TimerKey = { ROUND: 'round', REVEAL: 'reveal' } as const;
const EventType = { SPELL: 'spelling_fast.spell' } as const;

const AudioVoice = { NAIJA: 'naija', BRITISH: 'british', AMERICAN: 'american' } as const;
type AudioVoice = (typeof AudioVoice)[keyof typeof AudioVoice];

const configSchema = z.object({
  rounds: z.number().int().positive().default(8),
  secondsPerRound: z.number().int().positive().default(20),
  revealSeconds: z.number().int().positive().default(3),
  audioVoice: z.nativeEnum(AudioVoice).default(AudioVoice.NAIJA),
  replaysAllowed: z.number().int().min(0).default(1),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({ words: z.array(z.string().min(1)).min(1) });
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({ type: z.literal(ActionType.SPELL), text: z.string().min(1) });
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  idx: number;
  rounds: number;
  secondsPerRound: number;
  revealSeconds: number;
  audioVoice: AudioVoice;
  replaysAllowed: number;
  words: string[];
  deadline: EpochMs;
  solved: { playerId: string; at: EpochMs }[];
}

const POINTS = 1000;
const cur = (s: State): string | undefined => s.words[s.idx];

export const spellingFastGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.SPELLING_FAST,
    title: 'Spelling Fast',
    category: GameCategory.QUICK,
    mode: GameMode.SIMULTANEOUS,
    players: { min: 2, max: null, recommendedMax: 12 },
    capabilities: { needsTTS: true },
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
        audioVoice: input.config.audioVoice,
        replaysAllowed: input.config.replaysAllowed,
        words: input.content.words.map((w) => w.toLowerCase()),
        deadline: d,
        solved: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.ROUND, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.ROUND) return { state, effects: [] };
    if (state.solved.some((s) => s.playerId === ctx.actor.id)) return { state, effects: [] };
    const word = cur(state);
    if (!word) return { state, effects: [] };
    if (action.text.trim().toLowerCase() !== word) {
      return { state, effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }] };
    }
    return {
      state: { ...state, solved: [...state.solved, { playerId: ctx.actor.id, at: ctx.now }] },
      effects: [
        { kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id },
        { kind: EffectKind.PERSIST_EVENT, event: { type: EventType.SPELL, data: { idx: state.idx } } },
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
    const base: ViewPatch = { phase: state.phase, idx: state.idx, rounds: state.rounds };
    // SECRECY: the word + TTS instruction go to the DISPLAY ONLY (it speaks it). Players never get
    // the word during the round (the word IS the answer). Revealed to all only at REVEAL.
    if (audience.kind === AudienceKind.DISPLAY) {
      if (state.phase === Phase.ROUND && word) {
        base.speak = word;
        base.voice = state.audioVoice;
        base.replaysAllowed = state.replaysAllowed;
      }
    }
    if (state.phase === Phase.REVEAL && word) base.answer = word; // now safe for everyone
    if (audience.kind === AudienceKind.PLAYER) {
      base.length = state.phase === Phase.ROUND && word ? word.length : 0; // cue only, not the word
      base.solved = state.solved.some((s) => s.playerId === audience.playerId);
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
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
