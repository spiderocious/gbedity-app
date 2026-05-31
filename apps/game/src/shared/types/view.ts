import { z } from 'zod';

// server.view { audience, patch } models. The patch is the per-audience view-model; its
// shape varies by game + phase (see integration-plan §8). We parse a permissive superset:
// `phase` is the always-present discriminant, all per-game fields are optional, and unknown
// keys pass through (forward-compat as the backend adds phases). Screens read fields they
// know for the current game; absence is handled gracefully.

export const Audience = {
  DISPLAY: 'display',
  HOST: 'host',
  PLAYER: 'player',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

const RankedEntry = z.object({ name: z.string().optional(), playerId: z.string().optional(), pct: z.number().optional(), points: z.number().optional() }).passthrough();
const Defence = z.object({ id: z.string().optional(), text: z.string().optional(), votes: z.number().optional() }).passthrough();
const BoardEntry = z.object({ playerId: z.string().optional(), name: z.string().optional(), points: z.number().optional() }).passthrough();

// One permissive patch schema covering all 5 games' phases. Everything optional but `phase`.
export const ViewPatch = z
  .object({
    phase: z.string(),
    // shared
    rounds: z.number().optional(),
    // quizzes
    qIndex: z.number().optional(),
    prompt: z.string().optional(),
    options: z.array(z.string()).optional(),
    answered: z.boolean().optional(),
    correctIdx: z.number().optional(),
    // wordshot / word games
    roundIndex: z.number().optional(),
    letter: z.string().optional(),
    category: z.string().optional(),
    ranked: z.array(RankedEntry).optional(),
    yourScore: z.number().optional(),
    yourSubmission: z.string().nullable().optional(),
    // word_bomb
    round: z.number().optional(),
    holderId: z.string().optional(),
    used: z.array(z.string()).optional(),
    yourTurn: z.boolean().optional(),
    // hot_take_court
    defences: z.array(Defence).optional(),
    submitted: z.boolean().optional(),
    voted: z.boolean().optional(),
    ownDefenceId: z.string().nullable().optional(),
    // plead_your_case
    scenario: z
      .object({
        charge: z.string().optional(),
        defendant: z.string().optional(),
        facts: z.string().optional(),
        laws: z.string().optional(),
        precedents: z.string().optional(),
      })
      .passthrough()
      .optional(),
    // end-of-game
    board: z.array(BoardEntry).optional(),
    winnerId: z.string().optional(),
  })
  .passthrough();
export type ViewPatch = z.infer<typeof ViewPatch>;

export const ServerView = z.object({
  audience: z.string(),
  patch: ViewPatch,
});
export type ServerView = z.infer<typeof ServerView>;

// Shared phase names seen in the engine model (game-engine.md §0.5). Named constants.
export const Phase = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  ROUND: 'round',
  HOLDING: 'holding',
  SUBMISSION: 'submission',
  WRITING: 'writing',
  REVEAL: 'reveal',
  LEADERBOARD: 'leaderboard',
  DONE: 'done',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
