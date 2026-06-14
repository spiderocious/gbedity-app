import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import {
  AudienceKind,
  EffectKind,
  GameCategory,
  GameId,
  GameMode,
} from '@engine/constants';
import type {
  ActionCtx,
  Audience,
  GamePlugin,
  InitInput,
  RoundScore,
  StepResult,
  TickCtx,
  ViewPatch,
} from '@engine/types';

import { projectBoard, accrue } from '../shared/view-helpers';

// Guess The Word (PRD catalogue #20) — round-robin. Each round one player is the Guesser and the
// rest are the Audience (they know the word, answer questions vocally). One random Audience member
// is the Moderator and can nudge the question-count up/down. The Guesser types their one guess
// when ready. Scoring: timeLeft × questionsLeft × scoreMultiplier.
//
// Solo: not supported (inherently social/voice game).
// Admin content: `guess_the_word_packs` collection — curated word packs. Each word may contain
// `?` as a wildcard/blank character (e.g. "b?nana"). The guesser sees the word length only.

const Phase = {
  TURN_INTRO: 'turn_intro',
  GUESSING: 'guessing',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

const ActionType = {
  SUBMIT_GUESS: 'guess_the_word.submit_guess',
  ADJUST_COUNT: 'guess_the_word.adjust_count',
} as const;

const TimerKey = {
  TURN_INTRO: 'turn_intro',
  GUESSING: 'guessing',
  REVEAL: 'reveal',
} as const;

const configSchema = z.object({
  guessSeconds: z.number().int().positive().default(90),
  introSeconds: z.number().int().positive().default(4),
  revealSeconds: z.number().int().positive().default(5),
  startingQuestionCount: z.number().int().min(1).max(40).default(20),
  scoreMultiplier: z.number().int().positive().default(10),
});
type Config = z.infer<typeof configSchema>;

const contentSchema = z.object({
  packTitle: z.string().default('Guess The Word'),
  packCategory: z.string().default('General'),
  words: z.array(z.string().min(1)).min(1).default(['mystery']),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(ActionType.SUBMIT_GUESS), text: z.string().min(1) }),
  z.object({ type: z.literal(ActionType.ADJUST_COUNT), delta: z.union([z.literal(1), z.literal(-1)]) }),
]);
type Action = z.infer<typeof actionSchema>;

interface State {
  phase: Phase;
  // turn state
  order: string[];
  turnIdx: number;
  wordIdx: number;
  words: string[]; // shuffled word list from content — one word per turn
  // per-turn
  currentWord: string;
  guesserId: string;
  moderatorId: string;
  questionCount: number;
  startingQuestionCount: number;
  guessStartedAt: EpochMs;
  deadline: EpochMs;
  guessText: string | null;
  correct: boolean | null;
  // config mirrors (for view)
  guessSeconds: number;
  introSeconds: number;
  revealSeconds: number;
  scoreMultiplier: number;
  // accumulated scores
  scores: Record<string, number>;
  roundDeltas: Record<string, number>;
}

const pickModerator = (order: string[], guesserId: string, random: () => number): string => {
  const pool = order.filter((id) => id !== guesserId);
  return pool[Math.floor(random() * pool.length)] ?? guesserId;
};

export const guessTheWordGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.GUESS_THE_WORD,
    title: 'Guess The Word',
    category: GameCategory.PARTY,
    mode: GameMode.ROUND_ROBIN,
    players: { min: 2, max: 12, recommendedMax: 10 },
    capabilities: { needsValidation: false },
    solo: { supported: false },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const order = input.players.map((p) => p.id);
    const guesserId = order[0]!;
    const introEnd = (input.startedAt + input.config.introSeconds * 1000) as EpochMs;
    // Shuffle words so the pack order isn't predictable; cap at one word per player.
    const shuffled = [...input.content.words].sort(() => input.random() - 0.5).slice(0, order.length);
    // Pad if the pack has fewer words than players (repeat from the start).
    while (shuffled.length < order.length) shuffled.push(shuffled[shuffled.length % input.content.words.length]!);
    const state: State = {
      phase: Phase.TURN_INTRO,
      order,
      turnIdx: 0,
      wordIdx: 0,
      words: shuffled,
      currentWord: shuffled[0]!,
      guesserId,
      moderatorId: pickModerator(order, guesserId, input.random),
      questionCount: input.config.startingQuestionCount,
      startingQuestionCount: input.config.startingQuestionCount,
      guessStartedAt: input.startedAt,
      deadline: introEnd,
      guessText: null,
      correct: null,
      guessSeconds: input.config.guessSeconds,
      introSeconds: input.config.introSeconds,
      revealSeconds: input.config.revealSeconds,
      scoreMultiplier: input.config.scoreMultiplier,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      roundDeltas: Object.fromEntries(order.map((id) => [id, 0])),
    };
    return {
      state,
      effects: [
        { kind: EffectKind.BROADCAST },
        { kind: EffectKind.START_TIMER, key: TimerKey.TURN_INTRO, fireAt: introEnd },
      ],
    };
  },

  onAction(state: State, action: Action, ctx: ActionCtx): StepResult<State> {
    if (action.type === ActionType.SUBMIT_GUESS) {
      // Only the current guesser can submit; only during GUESSING phase; one submission allowed.
      if (state.phase !== Phase.GUESSING) return { state, effects: [] };
      if (ctx.actor.id !== state.guesserId) return { state, effects: [] };
      if (state.guessText !== null) return { state, effects: [] };

      const guessNorm = action.text.trim().toLowerCase();
      const wordNorm = state.currentWord.replace(/\?/g, '').toLowerCase();
      const correct = guessNorm === wordNorm;

      const timeLeftMs = Math.max(0, state.deadline - ctx.now);
      const timeLeftSec = Math.floor(timeLeftMs / 1000);
      const pts = correct ? timeLeftSec * state.questionCount * state.scoreMultiplier : 0;
      const roundDeltas = { ...state.roundDeltas, [state.guesserId]: pts };
      const scores = accrue(state.scores, roundDeltas);

      const revealEnd = (ctx.now + state.revealSeconds * 1000) as EpochMs;
      const next: State = {
        ...state,
        phase: Phase.REVEAL,
        guessText: action.text.trim(),
        correct,
        scores,
        roundDeltas,
        deadline: revealEnd,
      };
      return {
        state: next,
        effects: [
          { kind: EffectKind.CLEAR_TIMER, key: TimerKey.GUESSING },
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: revealEnd },
          { kind: EffectKind.ROUND_ENDED },
        ],
      };
    }

    if (action.type === ActionType.ADJUST_COUNT) {
      // Only the moderator can adjust; only during GUESSING phase.
      if (state.phase !== Phase.GUESSING) return { state, effects: [] };
      if (ctx.actor.id !== state.moderatorId) return { state, effects: [] };

      const newCount = Math.max(1, Math.min(40, state.questionCount + action.delta));
      const next: State = { ...state, questionCount: newCount };
      return { state: next, effects: [{ kind: EffectKind.BROADCAST }] };
    }

    return { state, effects: [] };
  },

  onTick(state: State, now: EpochMs, ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.TURN_INTRO) {
      const guessEnd = (now + state.guessSeconds * 1000) as EpochMs;
      const next: State = {
        ...state,
        phase: Phase.GUESSING,
        guessStartedAt: now,
        deadline: guessEnd,
        guessText: null,
        correct: null,
        questionCount: state.startingQuestionCount,
        roundDeltas: Object.fromEntries(state.order.map((id) => [id, 0])),
      };
      return {
        state: next,
        effects: [
          { kind: EffectKind.CLEAR_TIMER, key: TimerKey.TURN_INTRO },
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.START_TIMER, key: TimerKey.GUESSING, fireAt: guessEnd },
        ],
      };
    }

    if (state.phase === Phase.GUESSING) {
      // Timer expired — guesser ran out of time; 0 points.
      const revealEnd = (now + state.revealSeconds * 1000) as EpochMs;
      const next: State = {
        ...state,
        phase: Phase.REVEAL,
        guessText: null,
        correct: false,
        deadline: revealEnd,
      };
      return {
        state: next,
        effects: [
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: revealEnd },
          { kind: EffectKind.ROUND_ENDED },
        ],
      };
    }

    if (state.phase === Phase.REVEAL) {
      // Advance to next turn or end the game.
      const nextTurnIdx = state.turnIdx + 1;
      const isLastWord = nextTurnIdx >= state.order.length;

      if (isLastWord) {
        // All players have had a turn — game over.
        return {
          state: { ...state, phase: Phase.DONE },
          effects: [
            { kind: EffectKind.CLEAR_TIMER, key: TimerKey.REVEAL },
            { kind: EffectKind.BROADCAST },
            { kind: EffectKind.GAME_ENDED },
          ],
        };
      }

      // Move to next player's turn.
      const nextWordIdx = state.wordIdx + 1;
      const nextGuesserId = state.order[nextTurnIdx]!;
      const introEnd = (now + state.introSeconds * 1000) as EpochMs;
      const next: State = {
        ...state,
        phase: Phase.TURN_INTRO,
        turnIdx: nextTurnIdx,
        wordIdx: nextWordIdx,
        currentWord: state.words[nextWordIdx] ?? state.words[0]!,
        guesserId: nextGuesserId,
        moderatorId: pickModerator(state.order, nextGuesserId, ctx.random),
        deadline: introEnd,
        guessText: null,
        correct: null,
      };
      return {
        state: next,
        effects: [
          { kind: EffectKind.CLEAR_TIMER, key: TimerKey.REVEAL },
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.START_TIMER, key: TimerKey.TURN_INTRO, fireAt: introEnd },
        ],
      };
    }

    return { state, effects: [] };
  },

  view(state: State, audience: Audience, _ctx): ViewPatch {
    const base = {
      phase: state.phase,
      guesserId: state.guesserId,
      moderatorId: state.moderatorId,
      questionCount: state.questionCount,
      deadline: state.phase !== Phase.DONE ? state.deadline : null,
      guessSeconds: state.guessSeconds,
      order: state.order,
      turnIdx: state.turnIdx,
      board: projectBoard(state.scores, state.roundDeltas),
      yourScore: 0, // overridden per-player below
    };

    if (audience.kind === AudienceKind.DISPLAY) {
      // Display (spectator TV): sees the word + everything.
      return {
        ...base,
        word: state.currentWord,
        wordLength: state.currentWord.replace(/\?/g, '').length,
        guessText: state.phase === Phase.REVEAL ? state.guessText : null,
        correct: state.phase === Phase.REVEAL ? state.correct : null,
      };
    }

    const playerId = audience.kind === AudienceKind.PLAYER ? audience.playerId : undefined;
    const yourScore = playerId !== undefined ? (state.scores[playerId] ?? 0) : 0;
    const isGuesser = playerId === state.guesserId;
    const isModerator = playerId === state.moderatorId;

    if (isGuesser) {
      // Guesser: no word — only word length, so they can count characters.
      return {
        ...base,
        yourScore,
        wordLength: state.currentWord.replace(/\?/g, '').length,
        isModerator: false,
        isGuesser: true,
        // Reveal phase: show what they submitted and the real word.
        guessText: state.phase === Phase.REVEAL ? state.guessText : null,
        correct: state.phase === Phase.REVEAL ? state.correct : null,
        word: state.phase === Phase.REVEAL ? state.currentWord : null,
      };
    }

    // Audience / Moderator / HOST: can see the word.
    if (audience.kind === AudienceKind.PLAYER || audience.kind === AudienceKind.HOST) {
      return {
        ...base,
        yourScore,
        word: state.currentWord,
        wordLength: state.currentWord.replace(/\?/g, '').length,
        isModerator,
        isGuesser: false,
        guessText: state.phase === Phase.REVEAL ? state.guessText : null,
        correct: state.phase === Phase.REVEAL ? state.correct : null,
      };
    }

    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(state.roundDeltas).map(([playerId, points]) => ({
      playerId,
      points,
      reason: MESSAGE_KEYS.games.STARTED, // generic reason — no specific GTW key yet
    }));
    const maxPoints = state.guessSeconds * state.startingQuestionCount * state.scoreMultiplier;
    return { deltas, maxPoints };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
