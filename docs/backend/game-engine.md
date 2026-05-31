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

## 0.5 Hard rule — no inline variant strings (applies to ALL code)

> **Every variant string is a named constant in an `as const` POJO object, accessed by key.
> Never an inline string-literal union member, never a magic string as a discriminant or value.**
> The union *type* is derived from the constant object.

This is non-negotiable and applies everywhere in the backend — state phases, every discriminant
tag (`kind` / `type`), every enum-like config value, mode, category, audience kind, score reason,
message key. It is the same spirit as the persona's "no magic strings in responses," extended to
the whole codebase.

```ts
// apply: declare the values once, derive the type from them
export const StatePhase = {
  QUESTION: 'question',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
export type StatePhase = (typeof StatePhase)[keyof typeof StatePhase];

// usage
const s: { phase: StatePhase } = { phase: StatePhase.QUESTION };

// ✗ forbidden — inline literal union and magic-string assignment
type Bad = 'question' | 'reveal' | 'done';
const bad = { phase: 'question' };
```

**Engine-level constant objects** (the cross-cutting ones; per-game enums follow the same rule and
live in each game module):

```ts
export const GameCategory = {
  QUICK: 'quick', BRAIN: 'brain', PARTY: 'party', IMMERSIVE: 'immersive',
} as const;
export type GameCategory = (typeof GameCategory)[keyof typeof GameCategory];

export const GameMode = {
  SIMULTANEOUS: 'simultaneous', ROUND_ROBIN: 'round_robin',
  SUBMIT_REVEAL: 'submit_reveal', SUBMIT_VOTE: 'submit_vote', OPEN_PHASE: 'open_phase',
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

export const EffectKind = {
  BROADCAST: 'broadcast', TO_PLAYER: 'to_player', TO_DISPLAY: 'to_display',
  START_TIMER: 'start_timer', CLEAR_TIMER: 'clear_timer',
  REQUEST_VALIDATION: 'request_validation', REQUEST_AI: 'request_ai',
  PERSIST_EVENT: 'persist_event', ROUND_ENDED: 'round_ended', GAME_ENDED: 'game_ended',
} as const;
export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];

export const AudienceKind = {
  HOST: 'host', DISPLAY: 'display', PLAYER: 'player',
} as const;
export type AudienceKind = (typeof AudienceKind)[keyof typeof AudienceKind];

// reserved action type for service results re-entering the plugin (§5)
export const SystemActionType = {
  SERVICE_RESULT: 'system.service_result',
} as const;
export type SystemActionType = (typeof SystemActionType)[keyof typeof SystemActionType];
```

Every `type` block in this doc references these constants instead of inline literals. Each game's
own enums (its config enums, state phases, and `Action.type` discriminants) are declared the same
way inside that game's module — defined in the per-game spec docs (§8), never here.

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
GameRuntime           owns: the clock, effect execution, view fanout (via an injected sink),
   ▲ driven by              roster, snapshots
Session (Single|League)   owns: lifecycle, which plugin(s) run, leaderboard policy, aggregation
   ▲ held by
SessionManager        owns: the live sessions map, create/get/end, boot-time recoverAll().
   ▲ used by                ENGINE layer — imports NO transport; the OutputSink is injected.
Gateway (transport)   pure Socket.IO ↔ rooms/sessions bridge: provides the sink to the
                            SessionManager, looks sessions up there. Owns no game lifecycle.
```

Calls only ever go **down**. A plugin never calls up, never imports a socket, never imports Mongo.
The **gateway** (transport) and the **SessionManager** (engine) are separated so business logic
(the rooms service) depends on the SessionManager — never on the socket layer. The seam that makes
league "free": the plugin reports a `RoundScore` (raw points + max attainable); a *Single* session
shows the raw board, a *League* session converts each game to percent-of-max and aggregates (§4).
Same plugin output, two consumers.

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
  // init returns state AND its initial effects (e.g. arm the first timer + initial broadcast), so
  // startup flows through the same effect executor as every other step. (Earlier drafts showed
  // `: State`; that couldn't express the §8 "init emits startTimer + broadcast" behaviour — the
  // StepResult form reconciles them.)
  init(input: InitInput<Config, Content>): StepResult<State>;
  onAction(state: State, action: Action, ctx: ActionCtx): StepResult<State>;
  onTick(state: State, now: EpochMs, ctx: TickCtx): StepResult<State>;

  // Pure projections / queries.
  view(state: State, audience: Audience, ctx: ViewCtx): ViewPatch;
  scoreRound(state: State): RoundScore;     // raw points + the max attainable (see §4)
  isOver(state: State): boolean;
}

type StepResult<State> = { state: State; effects: Effect[] };
type EpochMs = number;
```

Note the plugin reports both the **raw points each player earned** and the **maximum attainable**
for the unit being scored (`RoundScore`, §4). The raw board is the plugin's own scale; the max is
what lets the Session normalize every game to a common percentage so league aggregation is fair.
The plugin never normalizes — it just reports its own ceiling.

### 2.1 Manifest — static identity + capability gating

```ts
// GameId is itself an as-const POJO registry of every game id (see GameId object below).
interface GameManifest {
  id: GameId;                       // GameId.QUIZZES, GameId.WORD_BOMB, … (stable, used in URLs/persistence)
  title: string;                    // display name
  category: GameCategory;           // §0.5 constant
  mode: GameMode;                   // §0.5 constant
  players: {
    min: number;                    // HARD floor — below this the game cannot run. Always enforced.
    max: number | null;             // HARD ceiling — above this the game breaks. null = unbounded.
    recommendedMax: number;         // UX comfort ceiling. Guidance only — NEVER enforced.
  };                                // PRD §6 (transcribes "min N, no hard cap, soft N")
  capabilities: {
    needsValidation?: boolean;  // unlocks REQUEST_VALIDATION Effect (Wordshot, synonyms, …)
    needsAI?: boolean;          // unlocks REQUEST_AI Effect (Plead Your Case)
    needsTTS?: boolean;         // display-side audio (Spelling Fast)
  };
}

// Every game id is a named constant — never an inline string anywhere.
export const GameId = {
  QUIZZES: 'quizzes', BIBLE_QUIZ: 'bible_quiz', SPELLING_FAST: 'spelling_fast',
  TYPING_FAST: 'typing_fast', WORDSHOT: 'wordshot', WORD_BOMB: 'word_bomb',
  SCRAMBLED_WORD: 'scrambled_word', MISSING_LETTERS: 'missing_letters',
  DEFINITION_RACE: 'definition_race', SYNONYMS: 'synonyms', ANTONYMS: 'antonyms',
  MILLIONAIRE: 'millionaire', TRUTH_OR_DARE: 'truth_or_dare', CATCH_THE_LIE: 'catch_the_lie',
  HOT_TAKE_COURT: 'hot_take_court',
  INVESTIGATION: 'investigation', PLEAD_YOUR_CASE: 'plead_your_case', PRESENTATION: 'presentation',
} as const;
export type GameId = (typeof GameId)[keyof typeof GameId];
```

The runtime **rejects** any Effect a plugin's capabilities don't permit. A plugin without
`needsAI` that emits `requestAI` is a bug caught at the seam, not in production.

**Player limits — the enforcement boundary.** `players.min` and `players.max` are *rules*: the
runtime enforces them (a session below `min` cannot start; a lobby above a non-null `max` triggers
overflow handling — host-picks or random, PRD §4/§7.1). `players.recommendedMax` is *guidance*: the
runtime **never enforces it** — it is surfaced only to the host UI as a "feels best at N" hint.
`max: null` means genuinely unbounded (the PRD's "no hard cap, soft N" — `recommendedMax` carries
the soft N). Keeping rule and guidance in separate fields is deliberate: collapsing them back into
one number (or one boolean) re-introduces the ambiguity this split exists to kill.

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

// Audience is a discriminated union keyed on AudienceKind (§0.5) — no inline literals.
type Audience =
  | { kind: typeof AudienceKind.HOST }
  | { kind: typeof AudienceKind.DISPLAY }
  | { kind: typeof AudienceKind.PLAYER; playerId: string; spectator: boolean };
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
// Discriminated union keyed on EffectKind (§0.5) — every `kind` is a named constant.
type Effect =
  // I/O — fanout
  | { kind: typeof EffectKind.BROADCAST }                                   // re-project view() to everyone
  | { kind: typeof EffectKind.TO_PLAYER; playerId: string }                 // re-project to one player
  | { kind: typeof EffectKind.TO_DISPLAY }                                  // re-project to display only
  // timers (runtime owns the real clock; key is plugin-chosen, scoped to the instance)
  | { kind: typeof EffectKind.START_TIMER; key: string; fireAt: EpochMs }   // absolute deadline → survives recovery
  | { kind: typeof EffectKind.CLEAR_TIMER; key: string }
  // async services — runtime executes, result re-enters as a synthetic Action (see §5)
  | { kind: typeof EffectKind.REQUEST_VALIDATION; ref: string; payload: ValidationRequest }   // gated by needsValidation
  | { kind: typeof EffectKind.REQUEST_AI; ref: string; payload: AIRequest }                    // gated by needsAI
  // persistence — runtime writes; plugin describes WHAT, not HOW
  | { kind: typeof EffectKind.PERSIST_EVENT; event: GamePlayEvent }         // game-play history for admin (PRD §9)
  // lifecycle signal to the Session above the runtime
  | { kind: typeof EffectKind.ROUND_ENDED }                                 // runtime calls scoreRound + advances
  | { kind: typeof EffectKind.GAME_ENDED };                                 // runtime calls isOver path
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

`scoreRound(state)` returns a `RoundScore`: the raw points each player earned **and the maximum
attainable** for that unit of play. It does **not** mutate a leaderboard and doesn't know whether
one exists.

```ts
interface ScoreDelta {
  playerId: string;
  points: number;            // integer; this game's own scale
  reason: MessageKey;        // a named message-key constant (§0.5), per-game — never an inline string
}

interface RoundScore {
  deltas: ScoreDelta[];      // raw points per player, this game's own scale
  maxPoints: number;         // the maximum a single player could have earned this round
}
```

- **Single session** keeps one raw `Leaderboard` and applies `deltas` per the
  `Leaderboard cadence` config (PRD §7.1). It does not need normalization — one game, one scale.
- **League session** accumulates each game's raw total and its summed `maxPoints`, then converts
  to a **percentage** per game when the game ends:
  `gamePct(player) = playerTotal / gameMaxTotal` (e.g. `3200 / 4000 = 80%`).

### Why percentage (resolves the old §9 normalization open-item)

Raw scales differ wildly between games, so summing raw points would let a high-ceiling game
dominate the league. Converting each game to **percent-of-max** puts every game on the same 0–100%
scale, so each contributes equally regardless of its raw point ceiling. The league aggregate then
sums (or averages) percentages per PRD §7.3 `Aggregate scoring`, applying `Game weight` (1×/2×/3×)
as a multiplier on the percentage.

```
player league score = Σ_games ( weight_game × gamePct_game(player) )
   where gamePct_game(player) = playerTotal_game / gameMaxTotal_game
```

The plugin only ever reports `{ deltas, maxPoints }` on its own scale. **All normalization and
aggregation live in the League session** — the plugin is unaware league mode exists. This is the
seam that makes "add to league" free and keeps every game fairly comparable.

---

## 5. Async services without async plugins

OpenAI (long-text validation only, ephemeral — PRD §8) and the Mongo-backed validation service
are async. The plugin stays synchronous. The loop:

```
plugin.onAction → effects:[{ kind: EffectKind.REQUEST_AI, ref: 'r1', payload }]
runtime: fire-and-forget the AI call (prompt shell from env + rubric from Mongo)
…later…
AI returns → runtime wraps it as a synthetic Action:
            { type: SystemActionType.SERVICE_RESULT, ref: 'r1', result }
runtime → plugin.onAction(state, syntheticAction, ctx)   // plugin resumes deterministically
```

(`ref` is a runtime-generated correlation id — a value, not a variant string — so it stays a
plain `string`. The action `type` is the named `SystemActionType.SERVICE_RESULT` constant, §0.5.)

The plugin treats a returned verdict exactly like any other action. This keeps the entire plugin
surface synchronous and pure even though real work is async, and it means a verdict that arrives
*after* a Redis recovery still routes correctly (the `ref` is in serialized state).

---

## 6. Determinism & recovery

- **Randomness**: the plugin never calls `Math.random()`. `init` receives a `seed`; any shuffling
  or random selection derives from a seeded PRNG the runtime provides via ctx. → replays and
  recovery are reproducible; tests are deterministic.
- **Time**: `now` is always passed in. No plugin reads the clock. → `onTick` is a pure function of
  `(state, now)`.
- **Snapshot**: the runtime serializes a **self-sufficient** snapshot to Redis on a debounced
  cadence — `{ gameId, seed, players, state, timers, pendingRefs }`. It carries everything needed to
  *reconstruct* a runtime on a cold boot (not merely refill a live one): `gameId` → plugin lookup,
  `seed` → identical PRNG, `players` → the view/scoring roster. `State` being plain JSON makes this
  trivial. The **room** is snapshotted separately (`gbedity:room:*`) so the room that owns a
  recovered game also survives.
- **Rehydrate (boot-time recovery)**: a `SessionManager.recoverAll()` runs once at startup (after
  Redis connects, before accepting traffic). It rebuilds rooms from their snapshots, then for each
  in-flight game snapshot reconstructs the runtime (same `instanceId` + `seed`), re-arms future
  timers, fires any deadline that passed during downtime, and re-broadcasts `view()` to reconnecting
  clients (PRD §10/§12 — "lose ≤30s"). Active room codes live in Redis sets so recovery enumerates
  without a `KEYS` scan.

---

## 7. The runtime ↔ plugin loop (one diagram)

```
WS action in ─► runtime: validate(Zod actionSchema) · rate-limit per player (PRD §14)
                         · check role/turn legality · check capability gating
             ─► plugin.onAction(state, action, ctx) ─► { state', effects[] }
             ─► runtime executes effects (EffectKind.*):
                   PERSIST_EVENT → Mongo (history)
                   START_TIMER / CLEAR_TIMER → clock
                   REQUEST_AI / REQUEST_VALIDATION → service (result re-enters as action, §5)
                   BROADCAST / TO_PLAYER / TO_DISPLAY → view(state', audience) → Socket.IO fanout
                   ROUND_ENDED → scoreRound(state') → session applies deltas → leaderboard
                   GAME_ENDED  → session advances (replay | next league game | end)
             ─► runtime: snapshot state' to Redis (debounced)

timer fires ─► runtime ─► plugin.onTick(state, now, ctx) ─► same effect/fanout/snapshot cycle
```

The runtime is written **once**. A game author writes ~6 pure methods + 3 schemas + a manifest.

---

## 8. How the contract gets validated

This doc deliberately contains **no game design** — no concrete game's `Config`/`State`/`Action`,
no per-game rules. Those live in **per-game spec docs** (one per game, reviewed individually) and
are then implemented as plugins.

The engine contract is proven not by examples in this doc but by building **two deliberately
opposite test games** against it once the engine exists:

- a **simultaneous** game (all players act at once; server-side answer secrecy via `view`;
  per-question runtime timer), and
- a **round-robin** game (turn assignment + legality gating; a re-armed runtime timer; an async
  validation request mid-turn that resumes the plugin synchronously via §5).

If both express cleanly with no escape hatch, the contract holds for the rest of the catalogue
(which are variations on simultaneous, ranked-simultaneous, round-robin, submit-reveal,
submit-vote, and open-phase). The proof obligation lives in those two builds + their spec docs,
not here. **Do not add concrete game logic to this document.**

---

## 9. Observability & debuggability

A message-passing system with async-via-synthetic-actions needs observability from day one. When
something breaks at 12am Lagos on launch day, we must be able to answer *"what was the state when
player X submitted at 22:43:17?"* — the difference between a 30-minute fix and a 3-day one.

### 9.1 Structured per-session event log

The runtime emits a structured event to a per-session stream for **every** state-machine moment:

- every **Action** received (incl. synthetic service-result actions),
- every **Effect** emitted,
- every **State transition**,
- every **snapshot** written / recovery performed.

```ts
const SessionEventKind = {
  ACTION_IN: 'action_in', EFFECT_OUT: 'effect_out', STATE_TRANSITION: 'state_transition',
  SNAPSHOT: 'snapshot', RECOVERY: 'recovery',
} as const;
type SessionEventKind = (typeof SessionEventKind)[keyof typeof SessionEventKind];

interface SessionEvent {
  roomCode: string;
  gameInstanceId: string;
  seq: number;                 // monotonic per session — total order for replay
  at: EpochMs;
  kind: SessionEventKind;      // §0.5 constant
  actorId?: string;            // who, when applicable (never the nickname text — id only)
  actionType?: string;        // the Action.type constant value
  effectKind?: EffectKind;     // the Effect.kind constant value
  stateBytes?: number;         // SIZE of state, not contents
  phaseFrom?: string;          // phase constant values only — never free content
  phaseTo?: string;
}
```

**Privacy + volume rule:** log **shape and size, never contents.** No question text, no player
answers, no nicknames, no case material — only ids, constant tags, sequence numbers, and byte
sizes. This keeps the stream cheap and keeps player/host PII (PRD §12 "no PII beyond nickname")
out of logs entirely. Full-content reconstruction, when truly needed, comes from replaying the
ordered action log against a known snapshot — deterministically (the plugin is pure, §6).

### 9.2 Admin session-event viewer

The admin (Block 2) exposes a per-session timeline over this stream: the ordered `seq` of
actions/effects/transitions for a room, with timestamps and the constant tags. Because the engine
is deterministic, an operator can replay a session from its snapshot + action log to reproduce a
bug exactly. (Persisted via the `PERSIST_EVENT` Effect / runtime hook, surfaced read-only in admin.)

### 9.3 Metrics

Emitted as counters/histograms to the metrics backend:

| Metric | What it tells us |
|---|---|
| `snapshot.debounce_rate` | how often we're snapshotting — tunes the debounce vs the ≤30s loss budget |
| `timer.drift_ms` | `firedAt − fireAt` per timer — clock/scheduler health; rising drift = overloaded loop |
| `ai.request_latency_ms` | OpenAI round-trip (histogram) — the long-text validation path |
| `validation.request_latency_ms` | Mongo/dictionary validation round-trip |
| `synthetic_action.arrived_during_recovery_ratio` | **key signal** — fraction of service results that land mid/post-recovery; a rising ratio means services are slow enough that recovery overtakes them |

These are the first dashboards we stand up — before any game ships.

---

## 10. Open items to resolve before/while implementing

1. **PRD drift — Word Bomb §7.2** (informational, not engine): §7.2 still lists "Lives per player /
   last player standing," which contradicts the updated §6 hold-time rule. To be cleaned in the PRD;
   noted here only so the test-game spec follows §6. *(No game logic in this doc — see §8.)*
2. **Validation / AI request shapes** (`ValidationRequest`/`AIRequest`): kept abstract on purpose.
   Concrete payloads are defined when we build the Validation + AI services — **not designed now.**
3. **Per-player rate limit values** (PRD §14): the runtime enforces; exact tokens/sec set with load
   testing.
4. **Snapshot debounce cadence**: the actual debounce interval vs the ≤30s loss budget (PRD §12) —
   tuned against the `snapshot.debounce_rate` metric (§9.3).

*(Resolved & removed: league normalization — now §4 percent-of-max. Removed: drawing channel — the
drawing game is cut for now.)*

---

## 11. What this doc commits us to (and what it doesn't)

**Commits:** the plugin is pure + serializable; the runtime owns time/I/O/persistence; Effects are
the only outward channel; `view(audience)` is the only projection; `scoreRound` (returning
`RoundScore` = raw deltas + max) is the only score output; single vs league is a Session concern
the plugin never sees and league normalizes to percent-of-max (§4); AI/validation are async via
synthetic actions; recovery rides on absolute-deadline + JSON state; every variant string is a
named constant (§0.5); the runtime logs a structured, size-not-contents event stream (§9).

**Doesn't commit (by design — not here):** any concrete game's logic, config, or content; the
concrete TypeScript module layout; Socket.IO event names; the Redis key schema; the Mongo
collections; validation/AI request payloads. Concrete games live in per-game spec docs (§8);
the rest comes in the implementation slices, built against *this* contract.
