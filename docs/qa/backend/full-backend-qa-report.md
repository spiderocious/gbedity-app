# Backend QA Report — Full Backend Slice (5 Games + Content/Validation/AI/Admin/Auth/League)

**Author:** Backend QA
**Date:** 2026-05-31
**Against:** [`full-backend-test-plan.md`](./full-backend-test-plan.md) ·
[`full-backend-handoff.md`](./full-backend-handoff.md) · [`full-backend-spec.md`](../../backend/full-backend-spec.md) ·
[`api-docs.md`](../../backend/api-docs.md) · engine [`game-engine.md`](../../backend/game-engine.md) · PRD
**Mode:** report-only (no source changed). Scratch probes + QA fixtures removed after the run; repo suite confirmed **10/10, 6 suites** afterward.

---

## 0. Environment (as run)

- **Server:** `nx dev backend` on `:8090`; real **Mongo** (`gbedity` DB) + **Redis** (native binaries).
- **Seeds:** ran `words.seed.ts` + `content.seed.ts`. The dev's Mongo already held the **full
  wordmaster bulk** (`words`: 1,243,253 across all 14 categories incl. `name/city/country`;
  `allwords`: 274,926) — more coverage than the small seed, fine for testing.
- **OpenAI:** shipped **placeholder key** (hermetic) → Plead evaluations return "evaluation failed"
  by design; I tested the degraded path. AI-up scoring is a real-key follow-up.
- **Methods:** live `curl` (HTTP), real `socket.io-client@4` (WS, isolated `/tmp`), deterministic
  Jest probes against seeded Mongo (validation/engine), `mongosh`/`redis-cli` for ground truth, and
  a **real `kill -9` → restart across an elapsed deadline** for recovery.
- **QA fixtures:** I seeded one `spicy` + one `religious`-tagged hot-take prompt to *prove the rating
  filter excludes* them, and used a seeded proper-noun (`name`) to prove Q3 precedence. All removed
  after; tiers back to family-only.

---

## 1. Verdict

**The two non-negotiables PASS:** (1) **content never escapes the rating filter** — server-side,
unbypassable, safe-closed on empty tiers; (2) **no authorship/answer/secret leaks** — Quizzes hides
`answerIdx`, Hot Take never projects `playerId`, admin seed password never hits logs, lobby excludes
tokens. The **5 games all run end-to-end to `done`→lobby with persistence**, the **multi-level
validation engine is correct across all levels**, admin **reuse-revoke + guard** are solid, **real
crash recovery + reconnect** work, and the **prior engine slice did not regress** (full §12 pass).

But there are **1 P0-adjacent security bug** and **a content-integrity bug** that block clean sign-off:

| Sev | Count | IDs |
|-----|-------|-----|
| **P1** | 3 | BUG-A (player can override Plead winner — not host-gated), BUG-B (admin content authoring does no schema validation), BUG-C (cursor pagination broken for bulk-seeded `words`) |
| **P2** | 1 | BUG-D (Hot Take spec configs `funniestBonusRound`/`anonymousVoting` not implemented) |
| **P3** | 2 | BUG-E (league weight leniently coerced vs api-docs `1\|2\|3`), DRIFT (quizzes action field name) |

No content-filter bypass, no secret leak, no engine regression. Details below; PASS inventory in §4.

---

## 2. Confirmed defects

### BUG-A — `plead.override` is not host-gated; any player can rig the winner — **P1 (security)**

**Where:** `games/plead-your-case/plead-your-case.plugin.ts:152-155`; the action path
(`game-runtime.ts dispatchAction` / `ActionCtx` / `gateway`).
**What:** The plugin's `onAction` accepts an `OVERRIDE` action from **any actor** and sets
`hostOverrideWinner = action.winnerId` with **no host check**. The comment says "host action" but
nothing enforces it: the gateway only binds the host *seat*, it doesn't tag actions with a role, and
`ActionCtx` carries only `{actor: {id,nickname}, now, random}` — **no role flag**, so the plugin
*cannot* tell host from player even if it tried. The runtime comment claims "the gateway has checked
role/turn legality," but action-level role is never checked.

**Repro (live, proven):** in a 2-player Plead game, a **regular player** emitted
`{type:"plead.override", winnerId:<their own id>}` at reveal → the reveal `winnerId` became **that
player**:
```
PLAYER set winnerId via override: pl_01KSZ2MZ…
reveal winnerId after PLAYER override: pl_01KSZ2MZ…   → PLAYER OVERRODE THE WINNER
```
**Impact:** defeats the host-override trust mechanism (PRD §14) and lets any player fix the round
winner / override the AI verdict. Security + fairness.

**Likely fix:** thread the actor's **role** into `ActionCtx` (the gateway knows it — host vs player
seat) and have the plugin reject `OVERRIDE` from non-host actors; or gate host-only action types at
the gateway/runtime before dispatch. (This is a general gap: *any* future host-only action — pause,
skip, boot, end — has the same hole today.)

---

### BUG-B — Admin content authoring performs no schema validation — **P1 (content integrity)**

**Where:** `features/admin/admin.controller.ts` content CRUD + `content-admin.repository.ts`.
**What:** `POST /admin/content/:kind` (and PATCH) **do not validate** the doc against the kind's
schema before inserting. Confirmed across **every** kind:
- `quiz_deck` with **no `ratingTier`** and `options:["a","b"]` (2, not 4) → **201**, persisted.
- `word` as `{word:"x"}` (no category/startsWith/tier) → **201**.
- `plead_scenario` as `{}` (empty) → **201**.

Cross-checked in Mongo: the malformed deck is stored with `ratingTier: undefined, options.length: 2`.

**Impact:** two-fold. (1) **Runtime breakage:** an under-specified deck (2 options, missing
`answerIdx` bounds) can break a game at play time. (2) **Rating-filter hole:** a doc with **no
`ratingTier`** never matches `ratingTier ∈ tiers`, so it's silently unservable — *or*, if any code
path defaults a missing tier, it could leak past the filter. Either way the rating system can't
classify it. Inconsistent, too: `PUT /admin/rubric` **does** validate (malformed → 422), but content
POST/PATCH does not.

**Expected (spec §2.3 / api-docs):** "validated against each game's `contentSchema`"; malformed →
**422** with `field_errors`. **Actual:** 201 + silent insert.

**Likely fix:** validate the body against the per-kind Zod schema in the content controller/service
(reuse each plugin's `contentSchema` where applicable), returning 422 + `field_errors` — same
discipline already applied to the rubric and to game `/start` (post-BUG-06 fix).

---

### BUG-C — Cursor pagination broken for bulk-seeded `words` (date sort key) — **P1**

**Where:** `shared/cursor.ts` codec + the admin list path's sort key.
**What:** `GET /admin/content/word?limit=2` returns page 1 + a `next_cursor` + `has_more:true`, but
following that cursor returns **0 items, `has_more:false`** — page 2 is empty. Decoding the cursor:
```
{"lastId":"WRDXXWORDD…","lastSortKey":"Thu Dec 25 2025 12:57:20 GMT+0100 (West Africa Time)"}
```
The sort key is a **locale `Date.toString()`**, not a stable/ISO value, so the cursor query can't
match the stored `createdAt`. **Contrast:** app-created docs (quiz_decks I made, with numeric
`createdAt`) paginate **correctly** — I walked 4 docs across 4 pages, then empty + `has_more:false`,
no dupes/gaps. So the bug is specific to records whose `createdAt` serializes as a `Date` string
(the bulk-seeded `words`).

**Impact:** the admin **word-list** browsing (the main "add words per category" surface, which sits
on the bulk DB) can't page past the first page. Also the cursor encodes a **locale-dependent,
timezone-bearing** string, which is fragile across environments.

**Likely fix:** serialize the cursor sort key as a stable form (epoch ms or ISO `Z`) and compare
against a normalized `createdAt`; ensure seeded and app-created docs share one `createdAt` type.

---

### BUG-D — Hot Take `funniestBonusRound` / `anonymousVoting` configs not implemented — **P2 (spec drift)**

**Where:** `games/hot-take-court/hot-take-court.plugin.ts:36-41` config schema.
**What:** Spec §3.4 lists `funniestBonusRound` (on), `anonymousVoting` (on), `category`,
`ratingFilter`, `excludeTags`; the plugin's `configSchema` has **only**
`rounds/submissionSeconds/votingSeconds/revealSeconds`. A host passing
`config:{funniestBonusRound:true, anonymousVoting:false}` has it **silently ignored** (Zod strips
unknown keys; default is always-anonymous, no bonus round). Anonymity is hard-wired on (good), but
the funniest-bonus axis (PRD §6.3) is absent.

**Note:** rating-filter + category *are* applied via the resolve path (server-side), so the
content-side configs aren't lost — only the gameplay toggles. Likely a deliberate deferral; flagging
the spec-vs-code gap so it's tracked, not a silent miss.

---

### BUG-E — League weight leniently coerced (P3) · DRIFT — quizzes action field (P3)

- **BUG-E (P3):** `league.service.ts` coerces `weight` to `2|3 else 1`. A `weight:5` request returns
  **201** (silently coerced to 1), not a 422 — api-docs says `1|2|3`. Lenient vs documented; harmless
  but undocumented. Either validate (422) or document the coercion.
- **DRIFT (P3):** spec §3.1 says the quizzes action is `{questionId, choiceIdx}`; api-docs + handoff
  say `{questionIdx, choiceIdx}`. The implementation accepts the action and flips `answered` (the
  game completes), so functionally fine — but the spec and api-docs disagree on the field name.
  Reconcile the docs (the game ran end-to-end, so the live shape is the source of truth).

---

## 3. Notes / non-issues caught during testing

- **Word Bomb min-players: NOT a bug.** An early harness run looked like a 2-player start succeeded;
  it was a **test-harness miscount** (my helper made host + 2 players = 3, meeting min 3). Clean
  repro with exactly 2 players → **409 `not_enough_players`**, correct. (Recording this so the
  false-positive isn't mistaken for a defect.)
- **Validation Level-3 full-score (SA-01):** a real-but-uncategorized word with **no category**
  scores 100; but every real game sets a category, so this path isn't reached in play. Benign.

---

## 4. PASS — verified clean (no defects)

| Area | Cases | Result |
|------|-------|--------|
| **Rating filter** (the headline guarantee) | CT-FILTER-1/2, CT-EMPTY, control | family-only **never** resolves the spicy QA prompt; `excludeTags` removes tagged; **empty tiers = 0 content (safe-closed)**; control proves spicy *is* resolvable when its tier is explicitly allowed (filter is real, not always-empty). |
| **Validation engine** (multi-level, no LLM) | VAL-L0..L4, NAME, DUP, CASE, EMPTY | L0 letter-gate=0; L1 exact=100/conf 1; L2 wrong-cat graded by farOffs; L3 dict-only invalid w/ category; L4 fuzzy → correct `suggestion`; **VAL-NAME (SA-02): proper noun validates at L1 via `words` DB though absent from `allwords`** (Q3 precedence holds); dup strict=0; case-insensitive; whitespace=0. |
| **Quizzes** | start, secrecy, end | 201; **no `answerIdx` in player QUESTION views**; ends → lobby; `game_play` written. |
| **Wordshot** | start, plan, feedback, end | 201; round plan exposes letter+category; player view carries `yourScore`/`yourSubmission`/`ranked` (top-N); ends → lobby. |
| **Word Bomb** | min, start, end | min-3 enforced (409); 3-player game runs round-robin to lobby. |
| **Hot Take Court** | **anonymity**, tally, end | **No `playerId` ever in any defence/tally across all player + display views**; tally only at reveal; ends → lobby. |
| **Plead Your Case** | degraded path, end | placeholder key → both players `ok:false, total:0`, **round still completes**, ends → lobby (Q5 graceful). |
| **Persistence** | PER-PLAY, PER-EVENTS | 9 `game_plays` across all 5 gameIds, correct shape; `session_events` carry **only** ids/tags/sizes — **0 events with content fields** (size-not-contents, PRD §12). |
| **Admin auth** | seed, login, reuse-revoke, redaction | seed 201 once / 409 twice / 403 disabled; login 401 wrong; **rotate → old refresh `session_revoked` AND new token also dead (family revoked)**; garbage → `token_invalid`; **seed password 0 occurrences in logs** (SA-10). |
| **Admin guard** | no-token, refresh-as-access | every `/admin/*` data route → **401 `unauthorized`** without a valid **access** token; refresh-as-access rejected (SA-11). |
| **Admin metrics/history** | metrics, game-plays | 200 with documented shapes; cursor meta present (pagination correct for app-created docs). |
| **Host auth** | register, dup, short-pw, login | 201; dup email 409; password<8 → 422 `field_errors.password`; wrong login → 401 `invalid_credentials`. |
| **League surface** | non-host, bad-game, empty, start, standings | 403 / 404 / 422 / 201 `{games:2}` / standings 200 (404 when none running). |
| **Recovery (real crash)** | REC-CRASH | **kill -9 mid-question → restart across the elapsed deadline → missed tick fired on recovery → game reached `lobby` at t=3s.** BUG-02 regression holds for a real game. |
| **Reconnect** | WS-RESUME (SA-15) | reconnect by token → `server.resumed {roomCode}` + fresh `server.view` of the **current** phase. |
| **§12 engine regression** | RG BUG-01/02/03/07/08 | all the prior 10-bug fixes intact: sim/real games end, recovery fires missed deadlines, idle sweep reaps, no half-applied transition on capability throw, validation-timeout advances. Repo suite 10/10. |

---

## 5. Recommended fix order

1. **BUG-A** (Plead override host-gating) — security/fairness; also the template for all future
   host-only actions (pause/skip/boot/end). Thread role into `ActionCtx` and gate.
2. **BUG-B** (admin content validation) — content-integrity + rating-classification hole; validate
   against each kind's schema → 422, same as the rubric path.
3. **BUG-C** (word-list cursor) — admin word browsing can't page; normalize the cursor sort key.
4. **BUG-D** (Hot Take funniest/anon configs) — confirm deferral or implement the bonus round.
5. **BUG-E / DRIFT** — validate-or-document league weight; reconcile the quizzes action field name in
   the spec vs api-docs.

**Re-test on fix:** I have a live repro for BUG-A and BUG-C, a multi-kind repro for BUG-B, and the
full suite (rating filter, validation, 5 games, admin, league, recovery, §12 regression) ready to
re-run against the fix branch.

## 6. Known limitations (per handoff — NOT filed as bugs)
AI needs a real key to actually score Plead (placeholder → "evaluation failed", verified graceful);
no LLM in validation (Q4); league ceremony minimal; other 13 games not built; shipped tests are
smoke-level (this QA pass is the deep coverage). Each documented seam behaved as the handoff said.

---

## Dev response — fixes applied (2026-05-31)

All 5 findings + the doc drift confirmed real (no false positives) and fixed.
**Build: Typecheck ✅ · Lint ✅ · Tests ✅ (12/12, 7 suites)** — incl. a new BUG-A regression. Working tree only (uncommitted).

| Bug | Fix |
|---|---|
| BUG-A (P1, host-only action) | Added `ActorRole` to `ActionCtx`; the runtime sets it from the gateway's verified role (host is token-verified at join). `plead.override` now rejects any non-host actor. Systemic — every future host-only action can gate on `ctx.role`. Regression test: `plead-override.test.ts` (player rejected, host honored). |
| BUG-B (P1, content validation) | Per-kind admin content schemas (`content-schemas.ts`) — `quiz_deck`/`word`/`hot_take_prompt`/`plead_scenario`, **ratingTier required**. `POST` validates full schema → 422 on malformed; `PATCH` validates the partial. Closes the rating-filter hole from missing tiers. |
| BUG-C (P1, cursor) | Content list now cursors on `_id` (ObjectId — monotonic + type-uniform on every doc, incl. bulk-restored words whose `createdAt` is a Mongo `Date`). Page 2 returns correctly. |
| BUG-D (P2, Hot Take) | `anonymousVoting` config now wired — when `false`, the reveal tally attributes defences by nickname; default `true` keeps full anonymity. `funniestBonusRound` config accepted, behaviour explicitly deferred (no-op, commented). |
| BUG-E (P3, league weight) | An explicit invalid weight now → 422 `validation_error` (was silently coerced to 1). Absent weight still defaults to 1. |
| DRIFT | Spec §3.1 corrected `questionId` → `questionIdx` (matches plugin + api-docs). |

Ready for re-test against the fix.

---

## QA re-test — verification of fixes (2026-05-31, round 2)

**Verdict: all 6 items VERIFIED CLOSED. No regressions. Slice signed off pending commit.**

Re-ran independently against the worktree: real Mongo + Redis, real `socket.io-client`, my own
probes (not the dev's tests). The engine contract changed (`ActionCtx` gained `role`), so I
re-ran the full §12 engine regression + a 5-game smoke to confirm the change didn't break anything.
Repo baseline confirmed **12/12, 7 suites** (was 10/10, 6 — +2 incl. the BUG-A regression). Scratch
probes + QA content removed after; Redis cleaned; suite still 12/12 green afterward.

| Bug | Sev | How I re-verified | Result |
|---|---|---|---|
| BUG-A | P1 (security) | **Live, both directions:** a **player** `plead.override` → winner **NOT applied** (rejected); the **host** `plead.override` → winner **applied** (honored). Confirmed `ActionCtx.role` is threaded from the token-verified gateway role and the plugin gates on `ctx.role !== HOST`. | ✅ CLOSED |
| BUG-B | P1 (integrity) | **Live, all 4 kinds + PATCH:** malformed `quiz_deck` (no tier / 2 options), minimal `word`, empty `plead_scenario`, no-tier `hot_take_prompt` → **422** `validation_error`; valid create → 201; PATCH bad tier → 422; valid PATCH → 200. Rating-tier now required (closes the filter hole). | ✅ CLOSED |
| BUG-C | P1 | **Live, bulk-restored `words`:** walked 4 pages × 3 = **12 items, 12 unique ids** (no dupes/gaps); cursor sort key is now the stable `_id` (`lastSortKey === lastId`), not the locale Date string. | ✅ CLOSED |
| BUG-D | P2 | **Live:** `anonymousVoting:true` (default) → reveal shows **no** author, no `playerId`; `anonymousVoting:false` → tally shows `author:<nickname>` but **still never `playerId`**. `funniestBonusRound` accepted (deferred no-op). | ✅ CLOSED |
| BUG-E | P3 | **Live:** league `weight:5` → **422** `validation_error` (was silent coerce); `weight:2` → 201. | ✅ CLOSED |
| DRIFT | P3 | spec §3.1 + api-docs both now `questionIdx`; plugin accepts `questionIdx` and gates `questionIdx === qIndex`. | ✅ CLOSED |

**Regression (must still hold) — all green:**
- §12 engine: BUG-01 (sim ends), BUG-02 (recovery fires missed deadline), BUG-07 (no half-applied
  transition), and `dispatchAction(actor, role, action)` accepts a player action — the new role
  param didn't break the contract.
- 5-game smoke: Quizzes/Wordshot/Word Bomb/Hot Take/Plead all run to `done`→lobby; **answer secrecy
  intact** (no `answerIdx` in player QUESTION views); **Hot Take anonymity intact** (no `playerId`
  leak); Plead degrades gracefully on the placeholder key.
- All round-1 PASS areas (rating filter unbypassable, validation levels, admin reuse-revoke + guard +
  password redaction, persistence size-not-contents, crash recovery, reconnect) were unaffected.

**Sign-off:** the full backend slice (5 games + content/validation/AI/admin/auth/league) is
**QA-passed** against the worktree.

**One housekeeping note (not a defect):** during the BUG-B re-test I dropped + reseeded the `admins`
collection to obtain a usable token (the prior admin's one-shot password wasn't recoverable), so the
dev Mongo now holds a `qa2@test.io` admin. Clear it (`db.admins.deleteMany({})`) before any real use.
This is test-data hygiene on the dev DB, not a code issue. Standing recommendation unchanged: commit
a baseline + the fix so QA/dev pin the same SHA (this verified the on-disk worktree).
