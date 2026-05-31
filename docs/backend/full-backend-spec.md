# Gbedity Backend — Full Spec: 5-Game Coverage Slice + Remaining Infra

**Status:** draft · spec only, no implementation yet · **review hard before any code**
**Goal:** finish the **entire remaining backend** in one coordinated push, using **5 games chosen
for total system coverage** as the end-to-end test harness. After this slice every backend system
(content, real validation, AI+rubric, league, persistence, admin, auth, history, resilience) is
exercised by a real game and provable. The other 13 games come later as pure plugin work.
**Source of truth:** the PRD. **Builds on:** [`game-engine.md`](./game-engine.md) (the plugin
contract — unchanged here) and [`build-phases.md`](./build-phases.md).
**Hard rules in force:** no inline variant strings (§0.5 of game-engine.md); no known gaps shipped;
`ServiceResult` at the service edge; `ResponseUtil` envelope; cursor pagination; never pass `req`
into services.

---

## 0. The 5 games and why exactly these

Picked so that **every remaining backend subsystem is consumed by at least one real game** — the
games are the test harness, not the easy wins.

| Game | PRD § | Engine mode | Exercises (the reason it's in the set) |
|---|---|---|---|
| **Quizzes** | 6.1 #1 | `SIMULTANEOUS` | content service + authoring, time-weighted scoring, answer secrecy, league entry, persistence |
| **Wordshot** | 6.1 #5 | `SIMULTANEOUS` (+ live ranking) | **the real validation engine** (Mongo word DB + fuzzy + dictionary), dup-handling, letter+category randomizer, rating filter on custom categories |
| **Word Bomb** | 6.1 #6 | `ROUND_ROBIN` | turn rotation + decaying timer + **reuses Wordshot validation** + no-repeat set; the round-robin shape (already de-risked by the test game) |
| **Hot Take Court** | 6.3 #16 | `SUBMIT_VOTE` | **submission → anonymous reveal → voting** mode; **server-side rating-filter enforcement** on platform prompts; anonymity integrity |
| **Plead Your Case** | 6.4 #18 | `SUBMIT_REVEAL` (+ AI) | **the AI service + rubric scoring**; rubric in Mongo (admin-tunable → unlocks 2.4); prompt shell in env; host override; absolute + comparative scores |

**Coverage matrix — nothing is left unexercised:**

| Subsystem | Quizzes | Wordshot | Word Bomb | Hot Take | Plead |
|---|:--:|:--:|:--:|:--:|:--:|
| Content service (1.16) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Content authoring admin (2.3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Real validation engine (1.17) | — | ✓ | ✓ | — | — |
| AI service (1.18) | — | — | — | — | ✓ |
| Rubric recalibration (2.4) | — | — | — | — | ✓ |
| Content rating filter (§8/§12) | — | ✓ (custom) | — | ✓ | ✓ |
| Live ranking (top-N) | — | ✓ | — | — | — |
| Voting machinery | — | — | — | ✓ | — |
| League percent-of-max (4.x) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Persistence + history (1.19/2.2) | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 1. The wordmaster asset (researched — confirmed available)

The existing **wordmaster** project (a Wordshot replica) has a production Mongo DB and a complete
validation engine we can lift. Verified live against `mongodb://127.0.0.1:27017/wordmaster`:

### 1.1 What's in the DB

| Collection | Count | Shape | Use for us |
|---|---|---|---|
| `words` | **1,243,257** | `{id, word, category, difficulty(1–3), startsWith, aliases[], popularity, validationCount, isApproved, …}` | the categorized word DB for Wordshot + Word Bomb |
| `allwords` | **274,926** | `{id, word, startsWith}` | plain dictionary — "is this a real word at all" |
| `validations` | 59 | validation log | not needed |
| `gamesessions`, `playerstats`, `users` | — | wordmaster-specific | not needed |

**14 categories:** `animal, app, bible, car, city, color, company, country, currency, disease,
food, language, name, place`. Distribution is lopsided: `city` (1.03M) and `name` (200k) dominate;
the **other 12 are tight curated lists** (food 4067, bible 3356, car 2304, color 1486, app 1186,
animal 864, language 546, company 462, disease 299, currency 267, country 247, place 22) — **~15k
words total excluding city/name**, with near-complete a–z letter coverage per category.

### 1.2 The engine pieces worth lifting (from `wordmaster-backend/src/services/`)

- **`word-validation.service.ts`** — `validateWord(word, {category, startsWith})`: lowercases,
  checks `startsWith` prefix, then a single Mongo lookup `getWordWithFilters(word, category,
  startsWith)`. Returns `{isValidWord, isValidCategory, isCorrectLetter, confidence, score}`.
  A sealed "v2" does graded partial-credit via the `farOffs` **category-distance matrix** (e.g.
  name↔bible = 2 "very close", color↔currency = 10 "far off") — we can adopt the simple v1 now and
  keep `farOffs` for later partial-credit.
- **`word-validation-model.ts`** — the Mongo layer: exact lookup + a full **fuzzy/similarity stack**
  (Levenshtein + Jaro + Soundex + longest-common-substring, weighted 0.4/0.3/0.2/0.1), alias
  matching, candidate generation. This powers Scrambled Word / Definition Race ranking later, and
  "did you mean" feedback.
- **`category-randomizer.service.ts`** — picks categories per letter with **non-successive
  sequencing**, weighted pools, global-usage balancing, and a sequence validator. Wordshot needs
  exactly this: "for letter A, pick a category that's well-stocked and not just-used."
- **`game-question.service.ts`** — letter generators: `generateBalanced` / `generateWeighted` /
  `generateCustom` (avoid consecutive vowels/consonants, min-distance between repeats). Wordshot's
  "random letter" generator.
- **`cache.service.ts`** — `NodeCache` get-or-compute with TTL. The "pre-compute / cache-ahead"
  pattern: precompute the next round's (letter, category, valid-answer-count) so validation at play
  time is a warm lookup.

### 1.3 Migration plan (one-time seed, not a live dependency)

We do **not** depend on wordmaster at runtime. We **export → transform → seed into our Mongo**.
**Per Q1: keep ALL 14 categories (incl. city/name/country).** For *this build* we seed only a
**small slice** so the pipeline + games work end-to-end; **the user handles the full bulk data
movement** afterwards (we hand them the exact command). In-game, the host **configures which
categories are active**, with **name / city / country enabled by default**.

1. **Small seed now:** `mongoexport` a capped sample per category (e.g. `--limit` per category, or a
   `$sample` aggregation) → a few hundred words covering all 14 categories + a slice of `allwords`.
   Enough to play + test; not the full 1.5M.
2. Transform into **our** collection shape (see §3.2) — strip wordmaster ids, keep
   `word/category/startsWith/difficulty/aliases/popularity`, set `ratingTier='family'` (Q2: all
   family-friendly), `isApproved` honored.
3. Seed via a versioned script (`docs/seeds/words.seed.mjs`) that upserts idempotently. Admin
   content-authoring (2.3) then edits the same collection.
4. **Full bulk (user-run, later):** we document the exact `mongoexport`/transform/seed command for
   all 14 categories so the user runs the full data movement once when ready. Until then the game
   runs on the small seed.

**This makes Wordshot + Word Bomb real on day one** — no hand-authoring of word lists.

---

## 2. Unlocked infra (built alongside the games that need them)

### 2.1 Content service (1.16) — game-agnostic core, per-game schemas

The plugin contract (`game-engine.md §2.2`) already says: the **Session/Runtime resolves content
server-side, rating-filtered, before `init()`** — the plugin receives clean `content`. So the
content service is what *produces* that resolved content. Shape:

```
ContentService.resolve({ gameId, config, ratingFilter, seed }) → Content   // typed per game
```

- **Storage:** Mongo. Collections per content kind: `quiz_decks`, `words` (shared by Wordshot +
  Word Bomb), `hot_take_prompts`, `plead_scenarios`. Each game's plugin declares its `contentSchema`
  (already in the contract); the content service validates DB rows against it on read.
- **Rating filter (§8/§12) — server-side, unbypassable:** every content row carries
  `ratingTier ∈ {family, friends, spicy, eighteen_plus}` and `contentTags[]` (sexual, religious,
  political, physical, relationship, …). `resolve()` filters to the host's selected tiers and
  excludes opted-out tags **before** the content ever leaves the server. The client never receives,
  and cannot request, content outside the filter. This is enforced in the resolve path, not the
  plugin.
- **Custom content (PRD §7.1):** host-supplied decks/word-lists/prompts are validated against the
  same `contentSchema` and the same rating rules, then merged with (or substituted for) platform
  content per the game's config. Custom content is **still rating-checked** (a host can't smuggle
  spicy content into a family room via custom).
- **Selection / randomization:** for Wordshot, the content service wraps the lifted
  category-randomizer + letter-generator to produce the round plan; deterministic via the engine
  `seed` so recovery/replay reproduce.

```ts
// content kind + rating constants (no inline variants)
export const ContentKind = {
  QUIZ_DECK: 'quiz_deck', WORD: 'word', HOT_TAKE_PROMPT: 'hot_take_prompt',
  PLEAD_SCENARIO: 'plead_scenario',
} as const;
export const RatingTier = {
  FAMILY: 'family', FRIENDS: 'friends', SPICY: 'spicy', EIGHTEEN_PLUS: 'eighteen_plus',
} as const;
export const ContentTag = {
  SEXUAL: 'sexual', RELIGIOUS: 'religious', POLITICAL: 'political', PHYSICAL: 'physical',
  RELATIONSHIP: 'relationship', UNDER_18_INAPPROPRIATE: 'under_18_inappropriate',
} as const;
```

### 2.2 Validation service (1.17) — real, lifted from wordmaster, **multi-level, NO LLM**

Replaces the `runValidation` stub. The engine already routes a `REQUEST_VALIDATION` Effect → service
→ synthetic action (§5), so plugins don't change. **Per Q3/Q4: replicate wordmaster's multi-level /
multi-layer validation exactly; absolutely no LLM in validation.**

```ts
ValidationService.validateWord(input: {
  word: string;
  category?: string;       // Wordshot/Word Bomb: must fit this category
  startsWith?: string;     // Wordshot: must start with this letter (Word Bomb: omitted)
  dupHandling: DupHandling;// strict / relaxed / synonym-tolerant (PRD §7.1)
  used?: string[];         // Word Bomb: no-repeat set this round
}): Promise<{
  valid: boolean;
  level: number;           // which validation level matched (1..N) — 0 = no match
  isRealWord: boolean;     // exists in `allwords`
  fitsCategory: boolean;   // exists in `words` with that category
  correctLetter: boolean;
  isDuplicate: boolean;
  confidence: number;      // 1 at level 1, steps down per level (graded)
  score: number;           // graded score (startingScore minus stepDown per level / farOffs)
  suggestion?: string;     // closest real word (fuzzy stack) — for "almost!" feedback
}>;
```

**The multi-level ladder (faithful to wordmaster `validateWordV2` + `farOffs`):**

- **Level 0 — letter gate:** if `startsWith` given and `word` doesn't start with it → reject
  immediately (score 0). (Wordshot only; Word Bomb passes no `startsWith`.)
- **Level 1 — exact category+letter hit (hard validation):** lowercased lookup in `words` filtered
  by `category` (+ `startsWith` if given). Hit → `valid`, `confidence 1`, full `startingScore`. This
  is the proven hot path: a single indexed Mongo query handles the overwhelming majority.
- **Level 2 — right word, *wrong* category (graded, `farOffs`):** word exists in `words` but under a
  different category. Score is reduced by the **category-distance matrix** `farOffs[wanted][found]`
  (2 = very close → small deduction; 10 = far off → large deduction). Confidence steps down. Lifted
  verbatim from wordmaster (the sealed-v2 block — we *unseal* it per Q3).
- **Level 3 — real word, not categorized:** exists in `allwords` only → `isRealWord:true`,
  `fitsCategory:false`. Whether it scores depends on the game (Wordshot: needs category, so 0;
  feedback says "real word, wrong category").
- **Level 4 — fuzzy / spelling near-miss:** the similarity stack (Levenshtein 0.4 + Jaro 0.3 +
  Soundex 0.2 + LCS 0.1, + alias match) finds the closest real word → `suggestion` for "Almost —
  closer next round." Configurable whether a high-similarity near-miss earns partial credit (default
  off — exact only scores).
- **Dictionary layer:** `allwords` lookup sets `isRealWord` independently so feedback distinguishes
  "not a word" from "real word, wrong category."
- **Dup handling (§7.1):** `strict` = first correct only (plugin tracks first); `relaxed` = all
  correct score; `synonym-tolerant` = aliases/Soundex-equal collapse to one answer (uses `aliases[]`
  + Soundex). `isDuplicate` checked against `used[]` (Word Bomb).
- **NO LLM (Q4):** there is no LLM path anywhere in validation. Everything is DB + deterministic
  fuzzy compute. (The category-DB hit is authoritative — a `words` hit alone validates a name/proper
  noun even though `allwords` won't contain it.)
- **Caching/precompute:** per-round precompute (letter, category) warms the category word-set
  (`NodeCache`) so play-time validation is a warm lookup; `words` is indexed on `word`, `category`,
  `startsWith`. Hot path (15 players × bursts, PRD §14) — tune with load test (6.3).
- **`farOffs` matrix** is lifted as a config constant (the full 14-category distance map from
  wordmaster) — exported as a named const, not inline.

### 2.3 AI service (1.18) — real, for Plead Your Case only

Replaces the `runAI` stub. OpenAI, **ephemeral** (no storage of prompts/responses), long-text only.

```ts
AIService.scorePlea(input: {
  scenarioId: string;
  facts: string; laws: string; precedents: string;   // the grounding material
  argument: string;                                    // the player's free-text defence
  rubric: PleadRubric;                                 // criteria + weights, from Mongo
}): Promise<{
  ok: boolean;                       // false → "evaluation failed" (AI down/timeout/parse)
  perCriterion: { criterion: string; score: number; rationale: string }[];
  total: number;                     // weighted 0–100 (absolute)
  groundingOk: boolean;              // did it reference supplied facts/laws (anti-hallucination)
}>;
```

- **Prompt shell = env** (`PLEAD_PROMPT_TEMPLATE`); **rubric = Mongo** (`plead_rubric` doc:
  criteria + weights, admin-tunable → that's exactly 2.4). The service composes
  `template + rubric + scenario + argument` at call time.
- **Absolute + comparative (your ruling):** each argument is scored **absolutely** (0–100 per the
  rubric) in its own call, AND after all submissions are in, a **comparative** pass ranks them
  against each other (one call, "rank these N exonerations"). Round winner = top comparative; the
  absolute scores + rationale are shown to all for trust (PRD §14).
- **Failure (your ruling):** if the AI call fails/times out/returns unparseable → result `ok:false`
  → the round shows **"evaluation failed"** for that player; it does not crash the game. *(Open Q5
  on what the round does with a partial failure — see end.)*
- **Grounding:** the prompt instructs "score only on the supplied facts/laws/precedents; flag if the
  argument invents facts." `groundingOk:false` is surfaced, not silently scored.
- **Host override (PRD §14):** the host can override the AI verdict for the round (a host action;
  the engine already supports host-role actions). Keeps trust when players rebel against the AI.
- **Partial failure (Q5):** **retry once**, then rank the successes; a still-failed player gets 0 +
  "evaluation failed" (round is not voided).
- **OpenAI key:** `OPENAI_API_KEY` is set with a **placeholder default** in `.env`/`.env.example`
  now; the user drops the real key later. With a placeholder, calls return `ok:false`
  ("evaluation failed") gracefully — everything else in the slice runs without it.

#### 2.3.1 `PLEAD_PROMPT_TEMPLATE` (the env prompt shell — authored here)

The service interpolates `{{...}}` placeholders with the scenario + rubric + argument at call time.
Two modes share one template family: **absolute** (score one argument) and **comparative** (rank
N). Stored in env as a single-line string; shown here expanded for readability.

```
You are an impartial legal evaluator for a party game called "Plead Your Case". You score a
player's written legal defence STRICTLY against the supplied case material and rubric. You never
invent facts, laws, or precedents that are not provided. If the argument relies on invented or
outside facts, lower the relevant score and set "groundingOk" false.

CASE
Charge: {{charge}}
Defendant: {{defendant}}
Facts: {{facts}}
Applicable laws: {{laws}}
Relevant precedents: {{precedents}}

RUBRIC (score each criterion 0–100; weights are for the caller, not you):
{{rubricCriteria}}        // e.g. "- legal_soundness: how well-grounded in the supplied laws\n- ..."

PLAYER ARGUMENT
{{argument}}

Return ONLY valid JSON, no prose, in exactly this shape:
{
  "perCriterion": [ { "criterion": "<key>", "score": <0-100>, "rationale": "<one sentence>" } ],
  "groundingOk": <true|false>
}
Score only on the supplied material. Be consistent and fair. Rationales must be one sentence each.
```

Comparative pass (after all submissions) uses a sibling template
`PLEAD_PROMPT_TEMPLATE_COMPARE` (same env-shell discipline):

```
You are ranking {{n}} legal defences for the SAME case (below) from strongest to weakest
exoneration. Use only the supplied case material. Return ONLY JSON:
{ "ranking": ["<argId>", ...] }   // best first
CASE: {{caseBlock}}
DEFENCES:
{{defences}}   // each as "argId: <id>\n<argument>"
```

The runtime composes `template`(env) + `rubricCriteria`(Mongo) + scenario + argument; parses the
JSON; on parse/HTTP/timeout failure → `ok:false`. The weighted `total` is computed **in our code**
from `perCriterion` × rubric weights (the model only scores criteria; we own the math).

### 2.4 Game-play persistence (1.19) — game-agnostic

Already half-specced in build-phases. Mongo: `game_plays` (summary record on game-end: room, gameId,
players[id+nick], finalBoard, started/endedAt) + `session_events` (the §9 size-not-contents stream,
written from `PERSIST_EVENT`). Cursor-paginated reads feed the admin viewer (2.2).

---

## 3. Per-game specs

Each game is a `GamePlugin` (pure, serializable — `game-engine.md §2`). Below: config, content
schema, state, action(s), validation, scoring, views, end condition. **All variant strings are
as-const POJOs in the game's module.**

### 3.1 Quizzes (`GameMode.SIMULTANEOUS`)

- **Config:** `rounds` (default 10), `secondsPerQuestion` (20), `revealSeconds` (3),
  `difficulty` (mixed), `scoringMode` (time_weighted | flat, default time_weighted),
  `wrongPenaltyPct` (0), `category` (general | nigerian | pop_culture | history | sports |
  sciences | custom), `leaderboardCadence` (every_round | every_n | end).
- **Content** (`quiz_decks`): `{ questions: [{ id, prompt, options: string[4], answerIdx, difficulty, ratingTier, tags[] }] }`.
  Resolved + difficulty-filtered + (rating-filtered if custom) server-side; seeded-shuffled by engine seed.
- **State:** `{ phase: question|reveal|done, qIndex, order[], deadline, answers: {playerId, choiceIdx, at}[] }`.
- **Action:** `{ type: 'quizzes.answer', questionIdx, choiceIdx }`.
- **Validation:** none external — `choiceIdx === answerIdx`. (Proves the *content* path, not validation.)
- **Scoring:** time-weighted (earlier correct = more, scaled to `maxPoints`); `flat` ignores time;
  `wrongPenaltyPct` subtracts. `scoreRound → {deltas, maxPoints}`.
- **Views:** display = prompt + 4 options + timer; player = tappable options, **answerIdx hidden**
  until reveal; reveal = correct option + score increments. (Answer secrecy via `view(audience)`.)
- **End:** `qIndex === rounds` (or time-limit mode) → `done` → `GAME_ENDED`.

### 3.2 Wordshot (`GameMode.SIMULTANEOUS` + live ranking)

- **Config:** `rounds` (default 10), `secondsPerRound` (20), `enabledCategories` (host-configurable
  multi-select from all 14 categories + custom; **default = all, with name/city/country always on**
  per Q1), `letterDifficulty` (common_only | includes_qxz | mixed), `dupHandling` (strict | relaxed |
  synonym, default strict), `scoringMode`, `wrongPenaltyPct`, `ratingFilter` (for custom categories),
  `rankingDisplayCount` (top 5).
- **Content** (`words` collection — seeded from wordmaster):
  `{ word, category, startsWith, difficulty(1–3), aliases[], popularity, ratingTier, tags[], isApproved }`.
  Indexes: `{word}`, `{category, startsWith}`, `{startsWith}`. (Matches wordmaster, + rating fields.)
- **Round plan (content service, lifted engines):** pick a **letter** (`game-question` balanced
  generator) + a **category** for it (`category-randomizer`, non-successive, well-stocked), seeded.
  Precompute the valid-answer count for "X possible answers" UX + cache warm.
- **State:** `{ phase: round|reveal|done, roundIndex, letter, category, deadline,
  submissions: {playerId, text, at, verdict?}[], ranked: {playerId, text, score}[] (top-N live) }`.
- **Action:** `{ type: 'wordshot.submit', text }`.
- **Validation (REQUEST_VALIDATION → ValidationService):** real-word + fits-category + correct-letter
  + dup-handling. Verdict re-enters as synthetic action (§5); on valid → score by speed; updates the
  live top-N ranking (broadcast). Capability: `needsValidation: true`.
- **Scoring:** faster valid = more; `maxPoints` = round ceiling. `strict` dup → only first valid per
  word scores.
- **Views:** display = "Letter + Category" + live top-N ranked guesses + timer; player = input +
  own private verdict/score (PRD: everyone sees their own score even if not top-N).
- **End:** `roundIndex === rounds` → `done`.

### 3.3 Word Bomb (`GameMode.ROUND_ROBIN`) — *the test game `test_round_robin` is its skeleton*

- **Config:** `rounds` (best of 1/3/5, default 3), `bombSecondsStart` (7), `decayPerRound` (on:
  7→5→4), `dupHandling` (default strict), `category` (single, from curated), `validationSeconds` (5).
- **Content:** reuses `words` (same collection). A round picks one category; valid = real word in
  that category, **no starting-letter constraint** (confirmed: Word Bomb reuses Wordshot validation
  *minus* `startsWith`).
- **State:** `{ phase: holding|await_validation|between|done, round, category, order[], turnIdx,
  turnStartedAt, deadline, used: string[] (no-repeat), pending? }`. (Same shape proven by the test game.)
- **Action:** `{ type: 'word_bomb.submit', text }` — current holder only (runtime turn-gates).
- **Validation:** `ValidationService.validateWord({word, category, used, dupHandling})` — no
  `startsWith`; `isDuplicate` against `used`. Valid + non-dup → score by hold-time, push to `used`,
  advance; repeat/invalid/timeout → 0, advance.
- **Scoring:** hold-time → points (longer hold = more; 0 on fail). Per PRD §6 update (no lives,
  no elimination). *(Flag: PRD §7.2 still says "lives/last-standing" — stale; we follow §6.)*
- **Views:** display = category + current holder + ticking bomb + words-used; holder phone = input
  ("your turn — go!"); others = "wait for your turn".
- **End:** all rounds done → `done`.

### 3.4 Hot Take Court (`GameMode.SUBMIT_VOTE`)

- **Config:** `rounds` (default 5), `submissionSeconds` (60), `votingSeconds` (45),
  `funniestBonusRound` (on), `anonymousVoting` (on), `category` (theme), `ratingFilter`,
  `excludeTags[]`.
- **Content** (`hot_take_prompts`): `{ prompt, ratingTier, tags[] }` (e.g. "Suya is overrated").
  **Rating-filtered server-side** — the headline reason this game is in the set.
- **State:** `{ phase: submission|reveal_vote|funniest|done, roundIndex, prompt,
  defences: {id, playerId, text}[] (playerId server-only — never in player view),
  votes: {voterId, defenceId}[], deadline }`.
- **Actions:** `{ type:'hot_take.submit', text }` (submission phase, one per player) ·
  `{ type:'hot_take.vote', defenceId }` (voting phase). **Always-vote** (your ruling): every player
  votes each voting phase; can't vote own defence; one vote per player per phase.
- **Validation:** none (peer-voted). The integrity requirements are: **(a) anonymity** — `view` for
  player/display audiences shows defences with a stable anonymous label, **never** `playerId`;
  **(b) rating enforcement** — only filtered prompts served.
- **Scoring:** votes received = points; **funniest bonus round** reuses the same vote machinery on a
  second axis. Plugin computes `{deltas, maxPoints}` from vote tallies.
- **Views:** display = prompt → (submission: "writing…") → (reveal: anonymous defences) →
  (vote tallies). Player = input, then vote buttons (own defence disabled).
- **End:** `roundIndex === rounds` → `done`.

### 3.5 Plead Your Case (`GameMode.SUBMIT_REVEAL` + AI)

- **Config:** `rounds` (default 3), `argumentSeconds` (300 / 3–10 min), `chargeSeverity`
  (minor | major | mixed), `showAiFeedbackToLosers` (on), `difficulty`, `ratingFilter`.
- **Content** (`plead_scenarios`): `{ id, charge, defendant, facts, laws, precedents, ratingTier,
  tags[], difficulty }`. (AI *generation* of scenarios is DEFERRED — we seed authored scenarios;
  generation is a later admin tool. *(Open Q6.)*)
- **Rubric** (`plead_rubric`, Mongo, admin-tunable → 2.4):
  `{ criteria: [{ key, label, weight }] }` e.g. legal_soundness 0.4 / persuasiveness 0.35 /
  use_of_precedent 0.25. Weights sum-normalized.
- **State:** `{ phase: writing|evaluating|reveal|done, roundIndex, scenario, deadline,
  submissions: {playerId, argument}[], results?: {playerId, perCriterion, total, ok, rank}[],
  pendingRefs[], hostOverride? }`.
- **Action:** `{ type:'plead.submit', argument }` (writing phase, one per player) · host:
  `{ type:'plead.override', winnerId }`.
- **AI (REQUEST_AI → AIService, capability `needsAI:true`):** on phase end, emit one
  `REQUEST_AI` per submission for the **absolute** score, then one comparative call to **rank**.
  Verdicts re-enter as synthetic actions (§5). On `ok:false` → that player shows "evaluation failed",
  excluded from ranking (or round void — *Open Q5*).
- **Scoring:** comparative rank → `deltas` (1st most points…); `maxPoints` = round ceiling. Absolute
  per-criterion breakdown shown to all (trust).
- **Views:** display = scenario (charge/facts/laws/precedents) → "evaluating…" → ranked results +
  rationale. Player = argument input → own breakdown.
- **End:** `roundIndex === rounds` → `done`.

---

## 4. Game-agnostic backend (built in the same push)

These don't depend on game schemas; they're the rest of the backend.

| # | Item | Spec summary |
|---|---|---|
| **2.1** | Admin auth | `admins` collection (email, bcrypt hash). `POST /admin/seed` — **idempotent, env-gated `CAN_SEED_ADMIN`**, generates a strong password, returns it **once** in the body (the one un-redacted password response; logs still redact), 409 if an admin already exists. `POST /admin/login` → JWT **access** (short) + **refresh** (long); refresh **rotation** + **reuse-revoke** (reusing an old refresh revokes the chain). Admin auth middleware guards `/admin/*`. `JWT_SECRET`, `JWT_REFRESH_SECRET` env. |
| **2.2** | Admin history + viewer | `GET /admin/game-plays` (cursor list, newest-first), `GET /admin/game-plays/:id`, `GET /admin/sessions/:instanceId/events` (the §9 timeline). Admin-auth gated. |
| **2.3** | Content authoring (per-game ports) | **Every content-bearing game gets its own admin port to add/edit content** (Q-final). Admin CRUD over each content collection — `quiz_decks` (questions/quizzes), `words` (add words per category), `hot_take_prompts` (debates/hot-takes), `plead_scenarios` (debates/cases) — with rating-tier + tags, validated against each game's `contentSchema`. Designed so the other 13 games slot in the same way (a port per content kind). This is the admin "content ingestion" surface. |
| **2.4** | Rubric recalibration | Admin GET/PUT `plead_rubric` (criteria + weights, sum-normalized). The AI service reads it at call time. |
| **2.5** | Per-game metrics/monitoring | Admin metrics surface (Q-final): per-game play counts, avg players, avg duration, completion rate, top categories, validation hit/miss rates, AI eval success/fail rates — derived from `game_plays` + `session_events` + service metric hooks (§9.3). Read-only dashboards data; one view per game, extensible to all 18. |
| **5.1** | Host auth | Same JWT machinery as 2.1, for hosts. Optional (PRD §9 — host can play without an account). Email+password, minimal PII. Enables saved presets later (5.2, deferred — needs game configs which now exist, so 5.2 becomes buildable too, *Open Q7*). |
| **4.1/4.2** | League surface | Engine already does percent-of-max + weighted aggregate (`LeagueSession`). This adds the **HTTP/WS surface**: host builds an ordered queue of {gameId, config, weight}, sets aggregate mode (sum/avg/top-3) + cadence + final-winner display. Now buildable because the 5 games define real configs. |
| **6.2** | Recovery tuning | Snapshot debounce vs ≤30s budget; "reconnecting"→"live" client protocol; payload minimisation (2G/3G). |
| **6.3** | Load testing | k6 ingestion-burst (15 players submitting simultaneously in Wordshot/Word Bomb); validation-service latency under burst; rate-limit tuning. |

---

## 5. Build order (dependency-correct)

1. **Seed words** — export wordmaster `words`(curated)+`allwords` → transform → seed our Mongo. *(Unblocks Wordshot/Word Bomb.)*
2. **Content service (1.16)** + rating filter — the resolve path every game needs.
3. **Validation service (1.17)** — lift wordmaster engine. *(Unblocks Wordshot/Word Bomb validation.)*
4. **Game-play persistence (1.19)** — wire `PERSIST_EVENT` + records.
5. **Quizzes** — simplest real game; proves content + scoring + league + persistence end-to-end.
6. **Wordshot** + **Word Bomb** — prove validation + randomizer + ranking + round-robin.
7. **Hot Take Court** — voting + rating enforcement.
8. **AI service (1.18)** + **Plead Your Case** + **rubric (2.4)** — the AI half.
9. **Admin auth (2.1)** + **history viewer (2.2)** + **content authoring (2.3)**.
10. **Host auth (5.1)**; **League surface (4.1/4.2)**.
11. **Recovery tuning (6.2)** + **load test (6.3)**.
12. Verify: tsc + lint + tests green; QA handoff updated.

---

## 6. Open questions (answer inline; nothing blocks until these are settled)

**Q1 — Wordshot/Word Bomb category set.** The curated DB has 12 clean categories (animal, app,
bible, car, color, company, country, currency, disease, food, language, place) + the giant
city/name. Recommendation: **ship the 12 curated** (drop city/name — 1.2M rows of noise a party
game doesn't need; "name" is also awkward to validate fairly). Keep city/name exportable for later. Keep city/name (they're the most important pieces, but just seed a little data, I'll handle the data movement, just tell me what we need to do, we do it when we're done only)
**Confirm: 12 categories, drop city/name?** No, dont drop. but for our game, let it be configurable for users to select the vategory they want in game, but name, city, country should be enabled by default.

**Q2 — Rating tier of seeded words.** The 12 curated categories are all clean → seed all as
`ratingTier: family`. **Confirm**, or do you want a pass to tag any (e.g. `disease`) differently? no need, all are family friendly.

**Q3 — "name"/proper-noun handling.** If we *do* keep any proper-noun category, dictionary
(`allwords`) won't contain most names, so `isRealWord` would be false for valid names. The category
DB (`words`) is the authority there. Recommendation: for category validation, a **`words` hit is
sufficient** (don't also require an `allwords` hit) — `allwords` is only the fallback "is it a word
at all" for feedback. **Confirm the precedence: category-DB hit wins.** see how the word validation works here:/Users/feranmi/codebases/wordmaster/wordmaster-backend/src/services/word-validation.service.ts  in wordshot, it has multilevel + multi layer checks, do exactly the same thing.

**Q4 — LLM fallback for novel words (PRD §8).** Recommendation: **defer** — the 15k curated DB
covers our 12 categories; build the seam + flag but ship on the DB path; turn on LLM fallback only if play shows too many valid-but-missing words. **Confirm defer.**. No llm for validations!

**Q5 — Plead partial AI failure.** If 1 of N players' evaluations fails (`ok:false`) but others
succeed: (a) rank only the successes, that player gets 0 + "evaluation failed"; or (b) void the
round (no scores) since comparison is unfair; or (c) retry once then (a). Recommendation: **(c)** —
one retry, then rank successes with the failed player at 0. **Confirm.** Ok

**Q6 — Plead scenario source.** Recommendation: **seed ~10 authored scenarios** for launch (PRD §14
says "aim for 10 of each"); AI *generation* of new scenarios is a later admin tool, not this slice.
**Confirm authored-seed now, generation later.** yes, okay

**Q7 — Host saved presets (5.2).** Now technically buildable (game configs exist). Include in this
push, or defer? Recommendation: **defer** — it's host-convenience, not coverage; this slice already
proves every system. **Confirm defer 5.2.** okay

**Q8 — Quizzes launch decks.** Need seed content. Recommendation: seed a small **Nigerian-coded
general-knowledge deck** (~50 Qs) + one neutral deck so league/category filtering is demonstrable.
Volume/source of these Qs — author by hand, or is there an existing source like the wordmaster DB?
**Need a source decision.** okay. 

**Q9 — Hot Take / Plead launch content.** Same as Q8: who authors the ~10 hot-take prompts and ~10
plead scenarios for launch? Hand-authored for now? **Need a source decision.** seed some hot take for now. when you build admin content authoring, I can add more content there.

**Q10 — Scope confirmation.** This is a *large* slice (3 new services, 5 games, full admin, auth,
league surface, load test). Realistic as one push, but it's days of work, not an hour. **Confirm you
want all of it specced→built in sequence**, or do you want to ship it in waves (e.g. Quizzes +
content + persistence + admin first, then the word games, then AI last)? YES I DO!

dont forget every game that needs content should have a port on the admin to add content, we'll do it for all games, invluding games that i need metrics to monitor, and also to add new words, questions, quizzes, debates etc. 

