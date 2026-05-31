# Gbedity Game Engine — Design Doc

**Status:** draft · design only, no implementation yet
**Scope:** the plugin/runtime contract that all 19 games sit on, and that makes a game
playable both standalone (single-game) and as an entry in a league with zero per-game code
difference.
**Source of truth:** the PRD (`dockito/projects/gbedity/prd.md`). Where this doc and the PRD
disagree, the PRD wins — flag the drift, don't silently diverge.

---

## 0. The one rule

> A game plugin is a **pure, JSON-serializable state-transition function**. It owns no
> clocks, no sockets, no persistence, no env, no DB. It declares *intent* (`Effect`s) and the
> **runtime** executes that intent.

Everything in this doc follows from that sentence. Purity + serializability is a single
constraint viewed twice: a plugin that obeys it is **unit-testable** (fake time, no I/O),
**snapshot-recoverable** (state is plain JSON in Redis), and **identical under single vs
league** (it never sees the session that drives it).

Locked decisions feeding this design:

- **Timers are runtime-owned.** Plugins request timers via Effects; the runtime owns the clock
  and calls `onTick`. (decision: runtime-owned)
- **Plugin `State` is plain JSON-serializable.** Deadlines are epoch-ms numbers, never `Date`.
  The runtime snapshots `State` to Redis and rehydrates on restart; timers are rebuilt from the
  deadline in state. (decision: serializable plugin state, PRD §12 "lose ≤30s")
- **AI rubric = Mongo (admin-tuned); prompt shell = env.** A plugin asks for AI via a
  `requestAI` Effect and never touches OpenAI, env, or Mongo. (decision: rubric=Mongo, prompt=env)

---

## 1. Why a plugin/runtime split (and not just "a game class")

The PRD requires (§4, §7.3) that the *same* game be:

- **Single-game**: lobby → configure → play → leaderboard → (replay | pick another | end).
- **A league entry**: queued with N other games, sequential, scores routed into a weighted
  cross-game aggregate, auto-advance between games.

If a game owned its own session lifecycle or leaderboard, "league" would mean re-implementing
every game. So those concerns are pulled **out** of the game and into a **Runtime** + **Session**.

```
GamePlugin            knows ONLY: one instance of itself (its rules, its state, its scoring math)
   ▲ called by
GameRuntime           owns: the clock, socket I/O, roster, effect execution, snapshots, persistence
   ▲ driven by
Session (Single|League)   owns: lifecycle, which plugin(s) run, leaderboard policy, aggregation
```

Calls only ever go **down** (Session → Runtime → Plugin). A plugin never calls up, never imports
a socket, never imports Mongo. The seam that makes league "free": the plugin emits
`ScoreDelta[]`; a *Single* session sums them into one board, a *League* session routes the same
deltas into a weighted aggregate. Same plugin output, two consumers.

---

## 2. The plugin contract

Generic over four plugin-defined types. All methods are **pure** and **synchronous**.

```ts
interface GamePlugin<Config, State, Action, Content> {
  readonly manifest: GameManifest;

  // Zod schemas the runtime validates against (plugin never validates I/O itself).
  readonly configSchema: ZodType<Config>;    // host-tunable; MUST define defaults
  readonly contentSchema: ZodType<Content>;  // what admin authors (deck / words / case)
  readonly actionSchema: ZodType<Action>;     // client → server messages for this game

  // Pure transitions. `now` and identity come in via ctx/args — never read from the clock.
  init(input: InitInput<Config, Content>): State;
  onAction(state: State, action: Action, ctx: ActionCtx): StepResult<State>;
  onTick(state: State, now: EpochMs, ctx: TickCtx): StepResult<State>;

  // Pure projections / queries.
  view(state: State, audience: Audience, ctx: ViewCtx): ViewPatch;
  scoreRound(state: State): ScoreDelta[];   // runtime/session owns the leaderboard
  isOver(state: State): boolean;
}

type StepResult<State> = { state: State; effects: Effect[] };
type EpochMs = number;
```

### 2.1 Manifest — static identity + capability gating

```ts
interface GameManifest {
  id: GameId;                       // 'quizzes' | 'word_bomb' | … (stable, used in URLs/persistence)
  title: string;                    // display name
  category: 'quick' | 'brain' | 'party' | 'immersive';
  mode: 'simultaneous' | 'round_robin' | 'submit_reveal' | 'submit_vote' | 'open_phase';
  players: { min: number; max: number; hardCap: boolean };  // PRD §6
  capabilities: {
    needsValidation?: boolean;  // unlocks `requestValidation` Effect (Wordshot, synonyms, …)
    needsAI?: boolean;          // unlocks `requestAI` Effect (Plead Your Case)
    needsDrawing?: boolean;     // unlocks the binary draw-stream channel (Sketch & Guess)
    needsTTS?: boolean;         // display-side audio (Spelling Fast)
  };
}
```

The runtime **rejects** any Effect a plugin's capabilities don't permit. A plugin without
`needsAI` that emits `requestAI` is a bug caught at the seam, not in production.

### 2.2 `init` — the runtime hands the plugin a resolved world

The plugin does **not** resolve its own content or handle overflow. The Session/Runtime resolves
the roster (after overflow selection — PRD §4) and the content deck (after rating filtering —
PRD §8/§12), then hands the plugin a clean input. This is what keeps single and league identical
from the plugin's point of view.

```ts
interface InitInput<Config, Content> {
  config: Config;            // already Zod-validated + defaults applied
  content: Content;          // already resolved + rating-filtered server-side
  players: PlayerRef[];      // already overflow-selected; spectators are NOT here
  seed: string;              // deterministic randomness source (see §6)
  startedAt: EpochMs;        // passed in, not read from a clock
}
```

### 2.3 Contexts — read-only request-scoped data, never `req`

```ts
interface ActionCtx { actor: PlayerRef; now: EpochMs; }   // who sent it, when runtime received it
interface TickCtx   { /* nothing yet; reserved */ }
interface ViewCtx   { ratingFilter: RatingFilter; }       // for answer-hiding / content gating
type Audience = { kind: 'host' | 'display' } | { kind: 'player'; playerId: string; spectator: boolean };
```

`Audience` is why `view` exists: the **same** state renders differently and the *answer is
hidden server-side* for players while visible to the display. Spectators (over-cap players,
PRD §4/§10) get the display projection but no input affordances. A client physically cannot
receive data `view` doesn't include — content-rating + answer-secrecy are enforced where the
client can't cheat (PRD §12).

---

## 3. Effects — the only way a plugin touches the world

A plugin returns `Effect[]`; the runtime executes them. This is the `ServiceResult`-style
"don't reach outside your layer" rule applied to games, and it's what makes plugins pure.

```ts
type Effect =
  // I/O — fanout
  | { kind: 'broadcast' }                                   // re-project view() to everyone
  | { kind: 'toPlayer'; playerId: string }                  // re-project to one player
  | { kind: 'toDisplay' }                                   // re-project to display only
  // timers (runtime owns the real clock; key is plugin-chosen, scoped to the instance)
  | { kind: 'startTimer'; key: string; fireAt: EpochMs }    // absolute deadline → survives recovery
  | { kind: 'clearTimer'; key: string }
  // async services — runtime executes, result re-enters as a synthetic Action (see §5)
  | { kind: 'requestValidation'; ref: string; payload: ValidationRequest }   // gated by needsValidation
  | { kind: 'requestAI'; ref: string; payload: AIRequest }                    // gated by needsAI
  // persistence — runtime writes; plugin describes WHAT, not HOW
  | { kind: 'persistEvent'; event: GamePlayEvent }          // game-play history for admin (PRD §9)
  // lifecycle signal to the Session above the runtime
  | { kind: 'roundEnded'; }                                 // runtime calls scoreRound + advances
  | { kind: 'gameEnded'; };                                 // runtime calls isOver path
```

Notes:

- `startTimer.fireAt` is an **absolute epoch-ms deadline**, never a duration. On Redis recovery
  the runtime re-arms any timer whose `fireAt` is in the future and immediately fires
  (`onTick`) any whose deadline passed during downtime. This is exactly how "lose ≤30s of state"
  (PRD §12) is honoured without the plugin knowing recovery happened.
- `broadcast`/`toPlayer`/`toDisplay` don't carry payloads — the runtime re-runs `view()` for the
  right audiences. The plugin never serializes its own wire format; `view()` is the single
  projection point.
- `requestValidation` / `requestAI` are the **only** async-looking things, and they're still
  expressed synchronously: the plugin says "I need X, tag it `ref`," and a verdict comes back
  later as an Action (§5). The plugin never `await`s.

---

## 4. Scoring & leaderboards — the league seam

`scoreRound(state)` returns deltas. It does **not** mutate a leaderboard; it doesn't know whether
a leaderboard exists.

```ts
interface ScoreDelta {
  playerId: string;
  points: number;            // integer; this game's own scale
  reason: string;            // message-key, e.g. 'word_bomb.held_long' (never an inline string)
}
```

- **Single session** keeps one `Leaderboard` and applies deltas after each round (cadence per
  `Leaderboard cadence` config, PRD §7.1).
- **League session** holds the per-game board *and* a cross-game aggregate. It applies the same
  deltas, then folds the game's result into the aggregate using `Game weight` (1×/2×/3×) and
  `Aggregate scoring` (sum/avg/top-3/custom) — PRD §7.3. The plugin is unaware.

Because `points` is "this game's own scale," the **league normalizes** (e.g. rank-based or
percent-of-max) at the aggregate layer — that policy lives in the League session, not the game.
*(Open item — see §9.)*

---

## 5. Async services without async plugins

OpenAI (long-text validation only, ephemeral — PRD §8) and the Mongo-backed validation service
are async. The plugin stays synchronous. The loop:

```
plugin.onAction → effects:[{ requestAI, ref:'r1', payload }]
runtime: fire-and-forget the AI call (prompt shell from env + rubric from Mongo)
…later…
AI returns → runtime wraps it as a synthetic Action: { type:'__service_result', ref:'r1', result }
runtime → plugin.onAction(state, syntheticAction, ctx)   // plugin resumes deterministically
```

The plugin treats a returned verdict exactly like any other action. This keeps the entire plugin
surface synchronous and pure even though real work is async, and it means a verdict that arrives
*after* a Redis recovery still routes correctly (the `ref` is in serialized state).

---

## 6. Determinism & recovery

- **Randomness**: the plugin never calls `Math.random()`. `init` receives a `seed`; any shuffling
  (question order, bomb start player, category pick) derives from a seeded PRNG the runtime
  provides via ctx. → replays and recovery are reproducible; tests are deterministic.
- **Time**: `now` is always passed in. No plugin reads the clock. → `onTick` is a pure function of
  `(state, now)`.
- **Snapshot**: runtime serializes `{ pluginId, state, timers, pendingRefs }` to Redis on a
  debounced cadence. `State` being plain JSON is what makes this trivial.
- **Rehydrate**: on restart, runtime reloads, re-arms future timers, fires any missed deadlines,
  and re-emits `view()` to reconnecting clients with a "reconnecting" → "live" transition
  (PRD §10/§12).

---

## 7. The runtime ↔ plugin loop (one diagram)

```
WS action in ─► runtime: validate(Zod actionSchema) · rate-limit per player (PRD §14)
                         · check role/turn legality · check capability gating
             ─► plugin.onAction(state, action, ctx) ─► { state', effects[] }
             ─► runtime executes effects:
                   persistEvent → Mongo (history)
                   startTimer/clearTimer → clock
                   requestAI/requestValidation → service (result re-enters as action, §5)
                   broadcast/toPlayer/toDisplay → view(state', audience) → Socket.IO fanout
                   roundEnded → scoreRound(state') → session applies deltas → leaderboard
                   gameEnded  → session advances (replay | next league game | end)
             ─► runtime: snapshot state' to Redis (debounced)

timer fires ─► runtime ─► plugin.onTick(state, now, ctx) ─► same effect/fanout/snapshot cycle
```

The runtime is written **once**. A game author writes ~6 pure methods + 3 schemas + a manifest.

---

## 8. Worked examples — two opposite games against the SAME contract

The contract earns its keep only if two maximally-different games express cleanly with no escape
hatch. Quizzes (simultaneous, no turns) and the updated Word Bomb (round-robin, hold-time
scoring) are deliberately opposite.

### 8.1 Quizzes (PRD §6.1 #1) — `mode: 'simultaneous'`

```ts
type Config  = { rounds: number; secondsPerQuestion: number; difficulty: Difficulty;
                 scoringMode: 'time_weighted' | 'flat'; wrongPenaltyPct: number };
type Content = { questions: { id: string; prompt: string; options: string[]; answerIdx: number }[] };
type Action  = { type: 'answer'; questionId: string; choiceIdx: number };

type State = {
  phase: 'question' | 'reveal' | 'done';
  qIndex: number;
  order: string[];                 // seeded question order
  deadline: EpochMs;               // current question deadline (absolute)
  answers: Record<string, { playerId: string; choiceIdx: number; at: EpochMs }[]>; // by questionId
};
```

- `init`: seed-shuffle question order, set `phase:'question'`, `deadline = startedAt + secondsPerQuestion*1000`,
  emit `{startTimer key:'q', fireAt: deadline}` + `broadcast`.
- `onAction('answer')`: record `(playerId, choiceIdx, at)` if before deadline and not already
  answered; emit `toPlayer` (lock their input). **No answer leaks** — `view` for a `player`
  audience never includes `answerIdx` until `phase:'reveal'`.
- `onTick` (deadline hit): `phase:'reveal'`, emit `broadcast` + `roundEnded`. Runtime calls
  `scoreRound`.
- `scoreRound`: for the current question, correct answers earn time-weighted points
  (`flat` ignores `at`); `wrongPenaltyPct` subtracts. Returns `ScoreDelta[]`.
- Advance: `onAction`/`onTick` moves `qIndex++`; when `qIndex === rounds` → `phase:'done'`,
  emit `gameEnded`.
- `view`: display shows prompt+4 options+timer; player shows tappable options (answer hidden);
  on reveal both show the correct option + everyone's score increments.

**Contract stress:** simultaneous ingestion (15 players answer at once → 15 `onAction` calls,
each pure), server-side answer secrecy via `view`, runtime-owned per-question timer. ✔ No escape hatch.

### 8.2 Word Bomb (PRD §6.1 #6, **updated rule**) — `mode: 'round_robin'`

> Updated PRD rule: bomb passes round-robin; **score = how long you held the bomb before
> submitting a valid, non-repeated category answer; repeat or timeout = 0.** No lives, no
> elimination. *(Note: PRD §7.2 still lists "Lives per player / last player standing" — that's
> stale vs the §6 narrative. Designing to §6, the canonical game rule. Flagged for PRD cleanup.)*

```ts
type Config  = { rounds: number; bombSecondsStart: number; decayPerRound: boolean;  // 7→5→4
                 dupHandling: 'strict' | 'relaxed' | 'synonym'; category?: string };
type Content = { categories: { name: string; accept: string[] }[] }; // accept = known-valid words (Mongo)
type Action  = { type: 'submit'; text: string };

type State = {
  phase: 'holding' | 'between' | 'done';
  round: number;
  category: string;
  order: string[];                 // seeded player rotation
  turnIdx: number;                 // whose bomb it is
  turnStartedAt: EpochMs;          // for hold-time scoring
  deadline: EpochMs;               // bomb timeout for the current holder (absolute)
  used: string[];                  // normalized answers already said this round (no-repeat rule)
  pending?: { playerId: string; text: string };  // awaiting validation verdict (§5)
};
```

- `init`: seed rotation + starting category; `turnIdx:0`; bomb deadline =
  `startedAt + bombSecondsStart*1000`; emit `startTimer key:'bomb'` + `broadcast`.
- `onAction('submit')` from the current holder only (runtime rejects non-holder via turn-legality
  check before calling the plugin): set `pending`, emit `{requestValidation}` (capability
  `needsValidation`) — "is `text` a real word in this category, per `dupHandling`?". *No score yet.*
- synthetic `__service_result` action (§5): if **valid + not in `used`** → compute
  `held = now - turnStartedAt`, stash a per-turn score (held-time scaled), push normalized text to
  `used`, advance `turnIdx`, reset `turnStartedAt`/`deadline` (apply `decayPerRound`), emit
  `clearTimer`+`startTimer`+`broadcast`. If **repeat or invalid** → score 0 for this turn, advance,
  emit feedback (`toPlayer` red flash per brand) + `broadcast`.
- `onTick` (bomb deadline, holder didn't submit): score 0 this turn, advance `turnIdx`,
  re-arm bomb, `broadcast`. When a full round completes → `phase:'between'`, `roundEnded`; when
  `round === rounds` → `done`, `gameEnded`.
- `scoreRound`: convert accumulated per-turn hold-times → `ScoreDelta[]` (longer hold = more
  points; zeros stay zero).
- `view`: display shows category + which player holds the bomb + ticking timer + words-used list;
  the holder's phone shows the input + "it's your turn — go!"; everyone else "wait for your turn."

**Contract stress:** turn assignment + legality (runtime-gated), a *decaying* runtime-owned timer
re-armed every turn, async validation mid-turn that resumes the plugin synchronously (§5),
no-repeat set in serialized state, hold-time scoring with zero-on-fail. ✔ No escape hatch.

### 8.3 What the two together prove

| Concern | Quizzes | Word Bomb | Contract handles it via |
|---|---|---|---|
| Simultaneous input | ✔ (all players) | — | `onAction` is pure & idempotent per player |
| Turn assignment + legality | — | ✔ | runtime turn-gate before `onAction` |
| Runtime-owned timer | per-question | per-turn, decaying, re-armed | `startTimer{fireAt}` + `onTick` |
| Answer secrecy / audience views | ✔ | partial | `view(state, audience)` server-side |
| Async service mid-game | — | ✔ validation | `requestValidation` → synthetic action (§5) |
| Recovery (deadline survives restart) | ✔ | ✔ | absolute `fireAt` in JSON state |
| Scoring decoupled from board | time-weighted | hold-time | `scoreRound → ScoreDelta[]` |

If both fit with no escape hatch, the remaining 17 (which are variations on simultaneous,
ranked-simultaneous, round-robin, submit-reveal, submit-vote, and open-phase) fit too.

---

## 9. Open items to resolve before/while implementing

1. **League score normalization** (§4): per-game `points` scales differ wildly (Quizzes vs Word
   Bomb). The League session must normalize before aggregating (rank-based? percent-of-max?
   z-score?). PRD §7.3 names sum/avg/top-3/custom *aggregation* but not *normalization*. Needs a
   decision; lives in the League session, never in a plugin.
2. **PRD drift — Word Bomb §7.2**: "Lives per player / last player standing" contradicts the
   updated §6 hold-time rule. PRD should be cleaned; this doc follows §6.
3. **Drawing channel** (Sketch & Guess, `needsDrawing`): live draw strokes are high-frequency and
   shouldn't go through `onAction`/snapshot every stroke. Likely a separate runtime-managed binary
   relay channel that bypasses plugin state, with only "round result" entering plugin state. To be
   specced when we reach Wave C.
4. **Validation request shape** (`ValidationRequest`/`AIRequest`): define the concrete payloads
   when we build the Validation + AI services (Block 1 steps 8). Kept abstract here on purpose.
5. **Per-player rate limit values** (PRD §14): the runtime enforces; exact tokens/sec to be set
   with load testing.

---

## 10. What this doc commits us to (and what it doesn't)

**Commits:** the plugin is pure + serializable; the runtime owns time/I/O/persistence; Effects are
the only outward channel; `view(audience)` is the only projection; `scoreRound` is the only score
output; single vs league is a Session concern the plugin never sees; AI/validation are async via
synthetic actions; recovery rides on absolute-deadline + JSON state.

**Doesn't commit yet:** concrete TypeScript module layout, the Socket.IO event names, the Redis key
schema, the Mongo collections, or any of the 19 games' full config/content schemas. Those come in
the implementation slices (Block 1), built against *this* contract.
