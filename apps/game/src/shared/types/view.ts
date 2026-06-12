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

const RankedEntry = z.object({ name: z.string().optional(), playerId: z.string().optional(), pct: z.number().optional(), points: z.number().optional(), text: z.string().optional(), closeness: z.number().optional(), score: z.number().optional() }).passthrough();
const Defence = z.object({ id: z.string().optional(), text: z.string().optional(), votes: z.number().optional() }).passthrough();
const BoardEntry = z.object({ playerId: z.string().optional(), name: z.string().optional(), points: z.number().optional(), roundDelta: z.number().optional() }).passthrough();

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
    answerIdx: z.number().optional(), // quizzes/bible: correct option, revealed only at REVEAL
    // wordshot / word games
    roundIndex: z.number().optional(),
    letter: z.string().optional(),
    category: z.string().optional(),
    ranked: z.array(RankedEntry).optional(),
    yourScore: z.number().optional(),
    // wordshot sends an object { text, valid, score }; other games may send a string.
    yourSubmission: z.union([z.string(), z.object({ text: z.string().optional(), valid: z.boolean().nullable().optional(), score: z.number().nullable().optional() }).passthrough()]).nullable().optional(),
    // scrambled-word / definition-race / relation (race-by-closeness games)
    scrambled: z.string().nullable().optional(),
    definition: z.string().nullable().optional(),
    yourClosest: z.number().nullable().optional(),
    relation: z.string().optional(),
    acceptedCount: z.number().optional(),
    yourAccepted: z.number().optional(),
    // word_bomb
    round: z.number().optional(),
    holderId: z.string().optional(),
    used: z.array(z.string()).optional(),
    yourTurn: z.boolean().optional(),
    // truth_or_dare
    choice: z.string().nullable().optional(),
    canVote: z.boolean().optional(),
    // presentation
    presenterId: z.string().nullable().optional(),
    topic: z.string().optional(),
    heckles: z.array(z.string()).optional(),
    youArePresenting: z.boolean().optional(),
    canRate: z.boolean().optional(),
    rated: z.boolean().optional(),
    // millionaire
    rung: z.number().optional(),
    ladder: z.array(z.number()).optional(),
    hiddenOptions: z.array(z.number()).optional(),
    eliminated: z.array(z.string()).optional(),
    banked: z.record(z.string(), z.number()).optional(),
    audienceTally: z.array(z.number()).optional(),
    canVoteAudience: z.boolean().optional(),
    youArePhoned: z.boolean().optional(),
    lifelinesUsed: z.array(z.string()).optional(),
    phoneSuggestion: z.number().nullable().optional(),
    // hot_take_court
    defences: z.array(Defence).optional(),
    submitted: z.boolean().optional(),
    voted: z.boolean().optional(),
    ownDefenceId: z.string().nullable().optional(),
    tally: z.array(z.object({ id: z.string().optional(), text: z.string().optional(), votes: z.number().optional(), author: z.string().nullable().optional() }).passthrough()).optional(),
    // catch_the_lie
    statements: z.array(z.string()).optional(),
    revealIdx: z.number().optional(),
    totalSubjects: z.number().optional(),
    isYou: z.boolean().optional(),
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
    // plead_your_case (results + winner)
    results: z
      .array(
        z
          .object({
            playerId: z.string().optional(),
            ok: z.boolean().optional(),
            total: z.number().optional(),
            perCriterion: z.array(z.object({ criterion: z.string().optional(), score: z.number().optional(), rationale: z.string().optional() }).passthrough()).optional(),
          })
          .passthrough(),
      )
      .optional(),
    // investigation (open-phase case file)
    title: z.string().optional(),
    brief: z.string().optional(),
    suspects: z.array(z.object({ id: z.string().optional(), name: z.string().optional(), profile: z.string().optional() }).passthrough()).optional(),
    evidence: z.array(z.object({ id: z.string().optional(), label: z.string().optional(), detail: z.string().optional() }).passthrough()).optional(),
    timeline: z.array(z.string()).optional(),
    solutionSuspectId: z.string().optional(),
    accusations: z.array(z.object({ playerId: z.string().optional(), suspectId: z.string().optional() }).passthrough()).optional(),
    yourAccusation: z.string().nullable().optional(),
    // missing_letters / word games with a masked answer + countdown
    idx: z.number().optional(),
    masked: z.string().nullable().optional(),
    length: z.number().optional(),
    answer: z.string().optional(),
    solved: z.boolean().optional(), // this player guessed CORRECTLY this round
    locked: z.boolean().optional(), // this player has SUBMITTED this round (right or wrong) — no retry
    deadline: z.number().optional(), // absolute epoch-ms — drives the countdown ring
    secondsPerRound: z.number().optional(),
    phaseSeconds: z.number().optional(), // generic active-phase length (drives the timer bar)
    revealSeconds: z.number().optional(),
    // typing-fast / spelling-fast
    passage: z.string().nullable().optional(),
    speak: z.string().optional(), // spelling-fast: the word for the DISPLAY to TTS (display audience only)
    voice: z.string().optional(),
    replaysAllowed: z.number().optional(),
    // end-of-game / scores
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
  COUNTDOWN: 'countdown', // brief server-timed "get ready" beat before round 1 (shared deadline)
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
