# Backend QA Test Plan — Full Backend Slice (5 Games + Content/Validation/AI/Admin/Auth/League)

**Author:** Backend QA
**Date:** 2026-05-31
**Tests against:** [`full-backend-handoff.md`](./full-backend-handoff.md) ·
[`full-backend-spec.md`](../../backend/full-backend-spec.md) · [`api-docs.md`](../../backend/api-docs.md) ·
[`build-phases.md`](../../backend/build-phases.md) · engine contract [`game-engine.md`](../../backend/game-engine.md) · PRD
**Builds on:** the previously QA-passed engine + room slice — see [`game-engine-qa-report.md`](./game-engine-qa-report.md). **This plan includes a full regression pass on that slice (§12).**
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`

> **Scope.** This slice makes the *entire remaining backend* real, exercised by 5 games chosen for
> total coverage: **Quizzes, Wordshot, Word Bomb, Hot Take Court, Plead Your Case**. New subsystems:
> content service + server-side rating filter, multi-level word validation (no LLM), AI scoring
> (Plead), game-play persistence, admin auth + history + metrics + content CRUD + rubric, host auth,
> league HTTP/WS surface, recovery/reconnect (`server.resumed`), k6 load. The engine contract is
> unchanged. Handoff baseline: **tsc/lint clean, tests 10/10 (6 suites), e2e smoke ✅**.
>
> **What I test.** The *guarantees*: server-side rating filtering that a client cannot bypass;
> answer/authorship secrecy via `view(audience)`; validation correctness across all 5 levels +
> dup-handling; AI graceful-degradation on the placeholder key + host override; admin JWT
> reuse-revoke; cursor pagination; league percent-of-max + weighting; persistence shape; and that
> **none of this regressed the engine** (recovery, lifecycle, the 10 prior fixes).

---

## 0. Organization & method

- **Mode 1 — source audit (§1):** read before executing; each row is a hypothesis + the exact case
  that confirms/refutes. Severity is pre-execution.
- **Mode 2 — execution (§2–§11):** grouped by subsystem. Exact assertions only — exact status, exact
  `error.code`, exact response/`view` shape, **and** ground-truth state (Mongo via `mongosh`, Redis
  via `redis-cli`, runtime via deterministic Jest, WS via `socket.io-client`).
- **§12 regression** on the engine slice. **§13 cross-cutting. §14 env. §15 order + exit criteria.**

Guardrails held: real Mongo + Redis (never mocked for integration); stub only OpenAI via the
placeholder key path (hermetic, as shipped); contract-parse every response; always test
missing-field / wrong-type / unauthorized / expired-or-reused / duplicate / out-of-turn / boundary /
degraded-service.

---

## 1. Mode 1 — source-audit findings (verify before execution)

Read the integrity-critical paths (validation service, content rating filter, admin auth, the 5
plugins, league/host services). Conventions remain clean (ServiceResult at edges, ResponseUtil,
no inline variant strings, cursor codec, admin middleware on `/admin/*`, engine imports no
`@features`). Findings below are behavioral/contract, each → a case in §2–§11.

| ID | Location | Finding | Sev (pre) | Confirms via |
|----|----------|---------|:---------:|--------------|
| SA-01 | `validation.service.ts:124-133` Level 3 | A real-but-uncategorized word (`allwords` hit) with **no category constraint** scores full **100** (`result.score = STARTING_SCORE`), overwriting the level-3 stepdown. For Word Bomb a category is always set, so this is the *no-category* path — confirm no game reaches it unintentionally (Wordshot always sets category+letter). | P3 | VAL-L3 |
| SA-02 | `validation.service.ts` Q3 precedence | Proper-noun categories (`name`, `city`, `country` — enabled by default per Q1) won't exist in `allwords`. A `words` hit must be **authoritative** (Level 1) without requiring an `allwords` hit. Confirm a seeded name validates at Level 1 and `isRealWord:true` is set from the `words` hit, not gated on dictionary. | P1 | VAL-NAME |
| SA-03 | `content.service.ts:20-26` `ratingClause` | Rating filter is `ratingTier ∈ tiers AND tags ∉ excludeTags`. If a host passes an **empty `tiers`** array, `$in: []` matches **nothing** (safe-closed) — confirm that's the behavior (no content rather than all content). Also confirm the filter is applied on **every** resolve path (quiz/word/hot-take/plead) and custom content. | P1 | CT-FILTER, CT-EMPTY |
| SA-04 | `hot-take-court.plugin.ts:36-41` config | Spec §3.4 lists `funniestBonusRound`, `anonymousVoting`, `category`, `ratingFilter`, `excludeTags` configs; the plugin's `configSchema` has **only** `rounds/submissionSeconds/votingSeconds/revealSeconds`. The funniest bonus round + anonymity toggle are **not implemented**. Drift — confirm and file as spec-vs-code gap (likely deferred). | P2 | HT-CONFIG |
| SA-05 | quizzes action shape | Spec §3.1 says action `{type:'quizzes.answer', questionId, choiceIdx}`; api-docs + handoff say `questionIdx`. Confirm the **actual** accepted field name; a client coded to the wrong one silently no-ops (out-of-turn ignore path). | P2 | QZ-ACTION |
| SA-06 | `content.service.ts:72-73` quiz sample | `resolveQuizQuestions` does `all.slice(0, sample)` after `flatMap` — **no shuffle** at the service layer (spec says "seeded-shuffled by engine seed"). Confirm shuffle happens in the plugin (deterministic by seed) and isn't lost — else decks always play in stored order. | P2 | QZ-SHUFFLE |
| SA-07 | `hot-take-court.plugin.ts:200` maxPoints | `maxPoints = max(1, defences.length - 1)` assumes everyone votes and no one votes self. With abstentions/disconnects, league percent-of-max could exceed 1.0 for a player if votes > maxPoints? No — votes per defence ≤ voters-1. Confirm `pct ≤ 1` holds under partial participation (disconnect mid-vote). | P2 | HT-PCT |
| SA-08 | `plead` ok:false / partial fail (Q5) | Spec Q5: retry once, then rank successes, failed player gets 0 + "evaluation failed" (round not voided). With the **placeholder key all fail** → confirm the round still completes, everyone "evaluation failed", `winnerId` resolves (null or first-ok), `GAME_ENDED` fires, room → lobby. | P1 | PL-ALLFAIL |
| SA-09 | `plead.override` authority | `plead.override` is a host action setting `hostOverrideWinner`. Confirm the **runtime/gateway gates it to the host** (a player emitting `plead.override` must be rejected/ignored) — else any player can fix the winner. | P1 | PL-OVERRIDE-AUTH |
| SA-10 | `admin/seed` password in body | `seed` returns the generated password **once** in the response body (by design) but logs must redact it. Confirm the password never appears in stdout logs (PII/secret), only in the one HTTP body. | P1 | ADM-SEED-REDACT |
| SA-11 | `admin-auth.middleware.ts` | Confirm **every** `/admin/*` data route (game-plays, metrics, sessions, rubric, content CRUD) rejects a missing/invalid/expired access token with **401 `unauthorized`**, and that an admin **refresh** token can't be used as an **access** token. | P1 | ADM-GUARD |
| SA-12 | content CRUD validation | `POST/PATCH /admin/content/:kind` must validate the doc against each kind's schema (rating tier required, options[4] for quiz, etc.). Confirm a malformed doc → **422** with `field_errors`, not a 500 or a silent insert. Unknown `:kind` → **404**. | P1 | ADM-CONTENT |
| SA-13 | league weight clamp | `league.service.ts:81` clamps weight to `2|3 else 1`. Confirm a weight of `0`/`5`/`-1` becomes `1` (not rejected) — document as lenient coercion vs the api-docs `1|2|3`. | P3 | LG-WEIGHT |
| SA-14 | rating filter on **custom** content | Spec §2.1: custom host content is still rating-checked (can't smuggle spicy into a family room). For real games `/start` ignores client `content` (api-docs: "client content ignored for real games"). Confirm real-game starts **ignore** any client-supplied `content` and resolve server-side only. | P1 | CT-CUSTOM |
| SA-15 | `server.resumed` reconnect | New `server.resumed` event (api-docs WS). Confirm a player reconnecting mid-game by token receives `server.resumed` + a fresh `server.view` for current state (not a stale one). | P2 | WS-RESUME |

---

## 2. Content service + server-side rating filter (the headline integrity guarantee)

The PRD §8/§12 promise: a client can never receive — or request — content outside the host's
selected tiers/tags. Tested at the resolve boundary and end-to-end through a game.

| # | Test | Method | Expected |
|---|------|--------|----------|
| CT-FILTER-1 | Family-only host never sees spicy | Seed a `hot_take_prompt` tier `spicy`; start Hot Take with host filter `tiers:[family]` | The spicy prompt **never** appears in any `server.view` across all rounds. Verify the served prompts are all `family` (cross-check `mongosh`). |
| CT-FILTER-2 | Excluded tag enforced | Seed prompts tagged `religious`; host `excludeTags:[religious]` | Tagged prompts never served. |
| CT-EMPTY *(SA-03)* | Empty tiers = safe-closed | resolve with `tiers:[]` | **No** content returned (not all). Game with no resolvable content → clean failure, not a crash (document the failure mode — 422/empty deck handling). |
| CT-CUSTOM *(SA-14)* | Real-game start ignores client content | `POST /start quizzes` with a malicious `content:{questions:[spicy]}` in the body | Client content **ignored**; server resolves from Mongo only. The injected content never reaches players. |
| CT-RESOLVE-PATHS | Every resolve path filters | static + per-game: quiz/word/hot-take/plead | Each `resolve*` applies `ratingClause`. Word resolution: confirm word categories are filterable / default family. |
| CT-CATS | Word categories | `contentService.wordCategories()` after seed | Returns the seeded categories; `name/city/country` present (Q1 default-on). |

**Cross-check (mongosh):**
```js
db.hot_take_prompts.find({ ratingTier: { $ne: "family" } })   // seed at least one spicy to prove filtering
db.words.distinct("category")                                  // confirm 14 cats incl name/city/country
```

---

## 3. Validation service — multi-level engine (no LLM)

Replaces the old stub; the engine routes `REQUEST_VALIDATION` → service → synthetic action. Test the
service **directly** (deterministic, against seeded Mongo) across all levels + dup handling.

| # | Test | Input | Expected |
|---|------|-------|----------|
| VAL-L0 | Letter gate | `{word:"zebra", category:"animal", startsWith:"a"}` | `valid:false`, `level:0`, `correctLetter:false`, `score:0`. |
| VAL-L1 | Exact category+letter | a seeded animal starting with its letter, e.g. `{word:"antelope", category:"animal", startsWith:"a"}` | `valid:true`, `level:1`, `fitsCategory:true`, `isRealWord:true`, `confidence:1`, `score:100`. |
| VAL-L2 | Right word, wrong category | a word seeded under `food` queried as `{category:"animal"}` (same first letter) | `level:2`, `fitsCategory:false`, `score = 100 − (farOffs[animal][food]/10)*100`, `valid` iff score>0. Cross-check the `farOffs` value. |
| VAL-L3 | Real word, uncategorized | a word in `allwords` only, `{word, category:"animal"}` | `level:3`, `isRealWord:true`, `fitsCategory:false`, `valid:false` (category required). |
| VAL-L3b *(SA-01)* | Uncategorized, no category | same word, `{word}` no category | `valid:true`, `score:100` — confirm this only happens when no category is required (no real game hits it). |
| VAL-L4 | Fuzzy near-miss | a misspelling of a seeded word, `{word:"antlope", category:"animal", startsWith:"a"}` | `valid:false`, `level:4`, `suggestion` = the closest seeded word ("antelope"). |
| VAL-NAME *(SA-02)* | Proper noun authoritative via words DB | a seeded `name` (won't be in `allwords`), `{word:"chioma", category:"name", startsWith:"c"}` | `valid:true`, `level:1`, `isRealWord:true` — `words` hit wins; not gated on dictionary. |
| VAL-DUP-STRICT | Word Bomb repeat | `{word:"dog", category:"animal", used:["dog"], dupHandling:strict}` | `isDuplicate:true`, `valid:false`, `score:0`. |
| VAL-DUP-SYN | Synonym-tolerant dup | a Soundex/alias match of a used word, `dupHandling:synonym` | `isDuplicate:true` (Soundex-equal or similarity>0.9 collapses). |
| VAL-DUP-RELAXED | Relaxed | a previously-valid word, `dupHandling:relaxed`, not in `used` | not duplicate; scores. |
| VAL-EMPTY | Empty/whitespace | `{word:"   ", category:"animal"}` | `valid:false`, `level:0` (trimmed to empty). |
| VAL-CASE | Case-insensitive | `{word:"ANTELOPE", ...}` | same as lowercase — Level 1 hit. |
| VAL-PERF | Burst latency (load context) | 15 concurrent `validateWord` calls | all resolve; capture latency for §11 load tuning (no assertion threshold yet — record). |

---

## 4. Quizzes (`SIMULTANEOUS`) — content + scoring + answer secrecy

| # | Test | Steps | Expected |
|---|------|-------|----------|
| QZ-START | Start happy | `POST /start {gameId:"quizzes", config:{rounds:3, category:"nigerian"}}` | 201, instance `gi_`, room `in_game`, init view fans out. |
| QZ-ACTION *(SA-05)* | Correct action field name | player sends `{type:"quizzes.answer", questionIdx:0, choiceIdx:1}` **and** `{...questionId...}` | Confirm which is accepted (api-docs says `questionIdx`); the wrong one is ignored (no score). File if spec/code disagree. |
| QZ-SECRECY | answerIdx hidden | capture player vs display view during QUESTION | Player view has **no** `answerIdx`; appears only at REVEAL. |
| QZ-SCORE-TW | Time-weighted | two players answer correctly, one earlier | earlier correct scores more; `scoreRound` deltas reflect time. |
| QZ-SCORE-FLAT | Flat mode | `config:{scoringMode:"flat"}` | time ignored; equal points for correct. |
| QZ-WRONG | Wrong answer | `choiceIdx ≠ answerIdx` | 0 (or −`wrongPenaltyPct` if set). |
| QZ-SHUFFLE *(SA-06)* | Deterministic shuffle | two starts, same seed vs different | same seed → same question order; different → different (and not always stored order). |
| QZ-DUP | Double answer | same player answers twice | second ignored. |
| QZ-END | Game ends → lobby | run all rounds | reaches `done`, `GAME_ENDED`, room → `lobby`, a `game_plays` record written (see §8). |

---

## 5. Wordshot (`SIMULTANEOUS` + live ranking) — real validation + randomizer

| # | Test | Steps | Expected |
|---|------|-------|----------|
| WS-START | Start | `{gameId:"wordshot", config:{rounds:2, enabledCategories:["animal","food"]}}` | 201; round plan picks a (letter, category); display shows "Letter + Category". |
| WS-VALID | Real word in category | submit a valid seeded word for the round's letter+category | scored by speed; appears in live **top-N** on display; player sees own score. |
| WS-GIBBERISH | Invalid → suggestion | submit gibberish near a real word | not scored; player gets a `suggestion` (near-miss, Level 4). |
| WS-WRONGCAT | Right word wrong cat | submit a word valid in another category | graded by farOffs (Level 2) — partial or 0 per distance. |
| WS-WRONGLETTER | Letter gate | submit a valid word with the wrong first letter | rejected (Level 0), 0. |
| WS-DUP-STRICT | First-correct-only | two players submit the same valid word, strict | only the first scores; second gets dup treatment. |
| WS-RANK | Live top-N | several valid submissions | display `ranked` updates, capped at `rankingDisplayCount` (5), sorted by score; each player still sees own private score even if not top-N. |
| WS-SECRECY | No answer leak | capture views | no "the answer"/valid-word-list leaked to players; only ranked top-N (which are players' own public submissions). |
| WS-END | Ends → lobby + persisted | run rounds | `done` → lobby; `game_plays` record. |

---

## 6. Word Bomb (`ROUND_ROBIN`) — turn rotation + decaying timer + validation + no-repeat

| # | Test | Steps | Expected |
|---|------|-------|----------|
| WB-MIN | Min players | start with 2 (min 3) | **409** `not_enough_players`. |
| WB-START | Start with 3 | `{gameId:"word_bomb", config:{rounds:1, category:"animal"}}` | 201; holder gets "your turn"; others "wait". |
| WB-VALID | Valid word | holder submits a valid animal (no startsWith) | scored by hold-time; word pushed to `used`; bomb advances to next holder. |
| WB-REPEAT | No-repeat | holder submits a word already in `used` | scores 0, bomb advances (dup). |
| WB-INVALID | Invalid | holder submits gibberish | 0, advance. |
| WB-NONHOLDER | Out-of-turn | a non-holder submits | ignored (no score, no error). |
| WB-TIMEOUT | Turn timeout | holder never submits within `bombSecondsStart` | turn times out → 0, advance (BUG-08-style path). |
| WB-DECAY | Decaying bomb | `decayPerRound:true`, multiple rounds | bomb seconds decrease across rounds (7→5→4). |
| WB-VALIDATION-TIMEOUT | Validation never returns | (deterministic: stub validation pending) | bounded VALIDATION timer advances the turn — no hang (regression guard for the prior BUG-08 fix in a real game). |
| WB-END | Ends → lobby + persisted | run round | `done` → lobby; `game_plays` record. |

---

## 7. Hot Take Court (`SUBMIT_VOTE`) — anonymity + rating enforcement

| # | Test | Steps | Expected |
|---|------|-------|----------|
| HT-MIN | Min players | start with 2 (min 3) | **409** `not_enough_players`. |
| HT-START | Start with 3 | `{gameId:"hot_take_court", config:{rounds:1}}` | 201; submission phase; rating-filtered prompt shown. |
| HT-ANON | Authorship never leaks | submit defences; capture player + display views in reveal/vote | defences carry only anonymous `id` + `text` — **no `playerId`** anywhere in any player/display view. (Server state holds `playerId`; projection strips it.) |
| HT-VOTE-OWN | Can't vote own | player votes own `defenceId` (via `ownDefenceId`) | ignored (no vote recorded). |
| HT-VOTE-DUP | One vote/player | player votes twice | second ignored. |
| HT-VOTE-WRONGPHASE | Vote in submission phase | vote before voting opens | ignored. |
| HT-TALLY | Tally only at reveal | capture views per phase | `tally` present only in REVEAL; not during submission/voting. |
| HT-PCT *(SA-07)* | percent ≤ 1 under abstention | a player disconnects mid-vote | leaderboard percent never exceeds 1.0 (votes ≤ maxPoints). |
| HT-CONFIG *(SA-04)* | funniest/anon configs | start with `config:{funniestBonusRound:true, anonymousVoting:false}` | Confirm these are **ignored** (not in schema) — file spec-vs-code drift; default behavior is always-anonymous, no bonus round. |
| HT-END | Ends → lobby + persisted | run round | `done` → lobby; `game_plays` record. |

---

## 8. Plead Your Case (`SUBMIT_REVEAL` + AI) — degraded path + host override

Placeholder OpenAI key ships by default → **every evaluation returns "evaluation failed"** (by
design). I test the degraded path is graceful; AI-up scoring is a follow-up with a real key.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| PL-START | Start | `{gameId:"plead_your_case", config:{rounds:1, argumentSeconds:30}}` | 201; scenario (charge/facts/laws/precedents) shown; capability `needsAI`. |
| PL-SUBMIT | Submit argument | players `{type:"plead.submit", argument:"..."}` | one per player; recorded server-side. |
| PL-ALLFAIL *(SA-08)* | Placeholder key → all fail | end writing phase (deadline) | each player result `ok:false` "evaluation failed"; **round still completes**; `winnerId` resolves (null or first-ok); `GAME_ENDED`; room → lobby. No crash. |
| PL-OVERRIDE | Host override | host `{type:"plead.override", winnerId:"<player>"}` | `winnerId` in reveal view = the override (takes precedence over AI rank). |
| PL-OVERRIDE-AUTH *(SA-09)* | Player can't override | a **player** emits `plead.override` | rejected/ignored — only the host seat may override. (Confirm via the runtime/gateway role gate.) |
| PL-FEEDBACK | Breakdown shown | reveal view | per-criterion + total shown to all (trust); with placeholder key, ok:false shown gracefully. |
| PL-RUBRIC | Rubric drives criteria | `GET /admin/rubric` → criteria; scoring math is ours (perCriterion × weight) | total computed in our code, not the model. (Verify with a real key in a follow-up; structurally confirm now.) |
| PL-END | Ends → lobby + persisted | run round | `done` → lobby; `game_plays` record. |

---

## 9. Persistence + observability

| # | Test | Steps | Expected |
|---|------|-------|----------|
| PER-PLAY | game_plays record | after any game ends | `db.game_plays` has a record: `{roomCode, gameId, players[{id,nickname}], finalBoard[{playerId,points}], startedAt, endedAt, createdAt}`. |
| PER-EVENTS | session_events | during a game | `db.session_events` rows (size-not-contents). **No** question text / answers / nicknames / argument text — ids/tags/sizes only (PRD §12). |
| PER-CURSOR | Cursor pagination | `GET /admin/game-plays?limit=2` then follow `next_cursor` | stable newest-first ordering, no dupes/gaps across pages, `has_more` correct, opaque cursor. |

---

## 10. Admin & Host auth + admin surface

### 10.1 Admin auth

| # | Test | Steps | Expected |
|---|------|-------|----------|
| ADM-SEED-1 | Seed (gated) | `POST /admin/seed {email}` with `CAN_SEED_ADMIN=true` | **201** `{email, password}` (password returned once). |
| ADM-SEED-2 | Seed twice | call again | **409** `conflict`. |
| ADM-SEED-3 | Seed disabled | with `CAN_SEED_ADMIN=false` | **403** `forbidden`. |
| ADM-SEED-REDACT *(SA-10)* | Password not logged | grep stdout after seed | password string appears **only** in the HTTP body, never in logs. |
| ADM-LOGIN-1 | Login ok | correct creds | **200** access+refresh. |
| ADM-LOGIN-2 | Wrong password | bad creds | **401** `invalid_credentials`. |
| ADM-REFRESH-1 | Rotate | valid refresh | **200** new pair (new jti). |
| ADM-REFRESH-2 | Reuse-revoke | use the **old** (rotated) refresh after rotating | **401** `session_revoked`; the whole family revoked (subsequent valid refresh also 401). |
| ADM-REFRESH-3 | Garbage token | random string | **401** `token_invalid`. |

### 10.2 Admin-guarded surface

| # | Test | Steps | Expected |
|---|------|-------|----------|
| ADM-GUARD-1 *(SA-11)* | No token | `GET /admin/game-plays` no header | **401** `unauthorized`. |
| ADM-GUARD-2 | Refresh-as-access | use a refresh token as Bearer | **401** `unauthorized` (wrong token type). |
| ADM-GUARD-3 | All routes guarded | hit metrics, sessions/:id/events, rubric GET/PUT, content CRUD without token | all **401**. |
| ADM-METRICS | Metrics shape | `GET /admin/metrics` (authed) | **200** `{byGame:[{gameId, plays, avgPlayers, avgDurationMs}]}`. |
| ADM-EVENTS | Session events | `GET /admin/sessions/:instanceId/events` | **200** size-not-contents stream for a real instance. |

### 10.3 Content authoring CRUD (per kind)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| ADM-CONTENT-1 | Create quiz_deck | `POST /admin/content/quiz_deck {valid doc}` | **201** doc. |
| ADM-CONTENT-2 *(SA-12)* | Malformed doc | quiz_deck missing `options[4]` / `ratingTier` | **422** `validation_error` + `field_errors` (not 500, not silent insert). |
| ADM-CONTENT-3 | Unknown kind | `POST /admin/content/bogus` | **404**. |
| ADM-CONTENT-4 | List + cursor | `GET /admin/content/word?limit=2` + follow cursor | paginated, stable. |
| ADM-CONTENT-5 | Get/Patch/Delete | create → GET/:id → PATCH partial → DELETE | 200/200/204; GET after delete → **404**. |
| ADM-CONTENT-6 | Authored content plays | add a `hot_take_prompt`, start Hot Take | the new prompt is eligible (rating-permitting) — closes the "admin adds content" loop. |
| ADM-RUBRIC | Rubric GET/PUT | `GET /admin/rubric`; `PUT {criteria}` (weights sum-normalized) | 200; PUT with malformed criteria → **422**; AI service reads updated rubric. |

### 10.4 Host auth

| # | Test | Steps | Expected |
|---|------|-------|----------|
| HOST-REG-1 | Register | `POST /host/register {email, password≥8}` | **201** tokens. |
| HOST-REG-2 | Dup email | register same email | **409** `conflict`. |
| HOST-REG-3 | Short password | `password:"123"` | **422**. |
| HOST-LOGIN | Login | correct/wrong | 200 / **401** `invalid_credentials`. |
| HOST-REFRESH | Reuse-revoke | rotate then reuse old | **401** `session_revoked`. |

---

## 11. League surface + recovery/reconnect + load

### 11.1 League (HTTP/WS)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| LG-START | Queue league | `POST /rooms/:code/league {hostId, aggregate:"sum", queue:[{gameId:"quizzes",weight:2},{gameId:"wordshot"}]}` | **201** `{code, games:2}`; games play sequentially, auto-advance. |
| LG-NONHOST | Non-host | wrong hostId | **403** `not_host`. |
| LG-BADGAME | Unknown game in queue | `queue:[{gameId:"nope"}]` | **404** `game_not_found`. |
| LG-MINPLAYERS | Below min | a queued game's min not met | **409** `not_enough_players`. |
| LG-EMPTY | Empty queue | `queue:[]` | **422** `validation_error`. |
| LG-WEIGHT *(SA-13)* | Weight coercion | `weight:5` / `0` / `-1` | coerced to `1` (document vs api-docs `1|2|3`). |
| LG-STANDINGS | Standings | `GET /rooms/:code/league/standings` mid/after | **200** `{standings:[{playerId, score}]}` sorted desc; percent-of-max + weight applied (a 2× game contributes double its percentage). |
| LG-NOLEAGUE | No league running | standings on a non-league room | **404** `not_found`. |
| LG-PCT | percent-of-max math | run 2 games with known scores | per-game pct = playerTotal/gameMaxTotal; aggregate sum of (weight × pct × 100). Matches engine §4 (regression of prior league math). |

### 11.2 Recovery / reconnect (regression + new `server.resumed`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| REC-CRASH | Real kill-restart mid-game | start a real game (e.g. Quizzes, short deadlines), `kill -9`, wait past a deadline, restart | room + game recovered; **missed deadline fires** on recovery (regression of BUG-02); game progresses/ends → lobby. |
| WS-RESUME *(SA-15)* | Reconnect → resumed | player reconnects by token mid-game | `server.resumed` + fresh `server.view` of **current** state (not stale). |
| REC-NOLEAK | Recovered game cleans up | recovered game ends | snapshot deleted; no orphaned `in_game` room (regression of BUG-01/03 interaction). |

### 11.3 Load (k6)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| LOAD-BURST | 15-player Wordshot burst | run the shipped k6 script | no 5xx; rate-limit fires per PRD §14; capture validation-service p95 latency; no dropped sockets. (Tune thresholds — record, don't gate yet.) |

---

## 12. REGRESSION — engine + room slice (previously QA-passed)

Re-run the prior sign-off against this slice to prove nothing broke. Source: the 10 fixed bugs +
PASS areas in [`game-engine-qa-report.md`](./game-engine-qa-report.md).

| # | Regression | Expected (must still hold) |
|---|------------|----------------------------|
| RG-01 | Baseline suite | `nx test backend` green (≥10/10, 6 suites — should be ≥ that now). |
| RG-02 | BUG-01 — sim/real game ends | every game reaches `done` → lobby (no hang in reveal). Covered by QZ/WS/WB/HT/PL `-END`. |
| RG-03 | BUG-02 — recovery fires missed deadline | REC-CRASH above. |
| RG-04 | BUG-03 — idle sweep wired | 60s sweeper still scheduled; idle room reaped (static + a fast-clock probe). |
| RG-05 | BUG-04 — host-leave suspension | host disconnect → `room_suspended`; return within grace → cancelled; else `room_ended`. |
| RG-06 | BUG-05 — WS host auth | host join needs `hostToken`; no/wrong token → `host_auth_failed`. |
| RG-07 | BUG-06 — bad config → 422 | bad game config/content via `/start` → **422** (not 500). Re-confirm per real game. |
| RG-08 | BUG-07/08 — transactional applyStep + validation timeout | capability violation no half-apply; WB-VALIDATION-TIMEOUT advances. |
| RG-09 | BUG-10 — `not_in_lobby` message | join in-game room → `not_in_lobby` with its own message. |
| RG-10 | PASS areas | answer secrecy, scoring/league math, async re-entry, observability size-not-contents, rate limiting, HTTP envelope — all still hold (covered across §2–§11). |
| RG-11 | HTTP edge | create/join/lobby/start exact codes unchanged (the §2/§3 cases from the prior plan). |

---

## 13. Cross-cutting checks

| # | Check | Expected |
|---|-------|----------|
| X-01 | Success envelope | `{data}` (+`meta` on lists). |
| X-02 | Error envelope | `{error:{code,message,field_errors?}}`; `code` ∈ documented stable set. |
| X-03 | New error codes present | `forbidden, invalid_credentials, token_invalid, token_expired, session_revoked, unauthorized` exist and are used correctly. |
| X-04 | IDs prefixed | players `pl_`, instances `gi_`, admin `ad_`/`adm_` (confirm prefix). |
| X-05 | No secrets/PII in responses | no `passwordHash`, no `playerId` in Hot Take defences, no `reconnectToken` in lobby, no `answerIdx` pre-reveal; admin seed password only in its one body. |
| X-06 | Observability size-not-contents | session_events carry no content (regression). |
| X-07 | No inline variant strings | spot-grep new modules for magic-string discriminants / inline unions. |
| X-08 | asyncHandler on async routes | all new routers wrapped. |
| X-09 | Services don't throw for domain failures | new services return ServiceResult; validation/AI failures are values, not throws. |
| X-10 | Content always server-resolved | real-game `/start` ignores client content (CT-CUSTOM). |

---

## 14. Environment & how to run

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env          # CAN_SEED_ADMIN=true, placeholder OPENAI key
# from apps/backend:
npx tsx --env-file=.env src/seeds/words.seed.ts         # ~2.6k words/14 cats + 5k dictionary
npx tsx --env-file=.env src/seeds/content.seed.ts       # quiz deck + hot-takes + plead scenario + rubric
nx dev backend                                          # :8090
```

- **Mongo required** (`MONGO_URL`). **Redis** for recovery (§11.2). Native binaries are fine (Docker
  not required) — same as the prior run.
- **Seeds:** I will also seed at least one **non-family** prompt and a **proper-noun** word to prove
  filtering (CT-FILTER-1) and Q3 precedence (VAL-NAME) — added via the admin content API or a small
  QA seed, removed after.
- **OpenAI:** keep the **placeholder** (hermetic) for the main pass; PL-ALLFAIL is the documented
  degraded path. A real-key follow-up would light up PL scoring (out of scope for the hermetic pass).
- **Tooling:** `mongosh`/`redis-cli` for ground truth; `socket.io-client@4` (isolated `/tmp` dir, no
  repo dep) for WS; deterministic Jest probes (fake timers, seeded Mongo) for validation/engine —
  all scratch probes removed after the run, Redis/Mongo QA data cleaned, repo suite confirmed green.

---

## 15. Execution order & exit criteria

**Order (highest-risk / dependency-correct):**
1. **§1 source findings** — confirm SA-02 (proper-noun validation), SA-03/SA-14 (rating filter can't
   be bypassed), SA-09 (override auth), SA-10/SA-11 (admin secrets/guard), SA-08 (Plead degraded).
2. **§2 rating filter + §3 validation** — the new integrity-critical engines.
3. **§12 regression** — prove the engine slice didn't break (fast, deterministic).
4. **§4–§8 the 5 games** end-to-end (HTTP+WS), each through to `done`→lobby + persistence.
5. **§9 persistence, §10 admin/host, §11 league/recovery/load.**
6. **§13 cross-cutting** sweep.

**Severity rubric:** **P0** breaks a security/data guarantee (rating bypass, secret leak, override
by non-host) or the engine contract · **P1** functional gap vs spec/PRD or auth hole · **P2** wrong
status/shape, spec-vs-code drift, untested degraded path · **P3** cosmetic / lenient coercion.

**Exit criteria:**
- **No content escapes the rating filter** (CT-* all pass) and **no authorship/answer/secret leaks**
  (HT-ANON, QZ-SECRECY, X-05) — these are non-negotiable for sign-off.
- All 5 games run end-to-end to `done`→lobby with a `game_plays` record; validation levels behave per
  spec; Plead degrades gracefully on the placeholder key; host override is host-only.
- Admin auth reuse-revoke + guard hold; content CRUD validates; cursor pagination is stable.
- **Full §12 regression green** — the prior 10 fixes and PASS areas intact.
- Every §1 finding fixed or accepted-and-documented with a ticket. No P0/P1 open.

**Known limitations I will NOT file as bugs** (per handoff): AI needs a real key to actually score;
word seed is a small sample; no LLM in validation (Q4); league ceremony minimal; other 13 games not
built; per-game deep suites are this QA pass (the shipped tests are smoke-level). I *will* verify each
seam behaves as documented.
```
