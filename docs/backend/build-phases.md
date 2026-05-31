# Gbedity Backend — Build Phases

**Companion to:** [`game-engine.md`](./game-engine.md) (the contract this plan implements).
**Source of truth:** the PRD. Where this plan and the PRD disagree, the PRD wins.

This is the living tracker for the v1 backend. Update the **Status** column as work moves. Do not
delete completed items — they're the record.

---

## Status legend

| Status | Meaning |
|---|---|
| `todo` | Not started |
| `spec_needed` | Needs a spec doc before code (games, AI/validation payloads) |
| `doc_written` | Spec/design doc written, awaiting review |
| `in_progress` | Being implemented |
| `blocked` | Waiting on a dependency or a decision |
| `code_review` | Implemented, in code review |
| `awaiting_qa_review` | Merged, QA handoff written, not yet picked up |
| `qa_testing` | QA actively testing |
| `done` | Implemented, reviewed, QA-passed |

---

## Effort map (share of the v1 backend)

| Block | Share | Note |
|---|---|---|
| 0 — Foundations | ~8% | the floor everything sits on |
| **1 — Engine + infra** | **~35%** | **what we build first — the spine** |
| 2 — Admin | ~12% | |
| 3 — Game plugins (×18) | ~30% | parallelizable once Block 1 closes |
| 4 — League polish | ~5% | |
| 5 — Host accounts | ~5% | |
| 6 — Resilience hardening | ~5% | |

Block 0 + 1 together ≈ **43%** of the v1 backend, front-loaded by design.

---

## Block 0 — Foundations

The HTTP/infra primitives every later block depends on. No game logic.

| # | Item | Description | Status |
|---|---|---|---|
| 0.1 | Response contract | Replace scaffold's flat `{error,message}` with `ResponseUtil` envelope (`{data}` / `{error:{code,message,field_errors}}`), `ServiceResult<T>`, `ERROR_CODES`, `asyncHandler`, global error middleware. | `qa_testing` |
| 0.2 | Message-key registry | Central message catalog sliced per feature; no inline response strings. | `qa_testing` |
| 0.3 | Request context | `AsyncLocalStorage` request context (request_id, role, etc.); services never see `req`. | `qa_testing` |
| 0.4 | Redis client | Single Redis client for room snapshots + pub/sub; `REDIS_URL` env. | `qa_testing` |
| 0.5 | Mongo confirm | Confirm existing Mongo client/`Db` access pattern; collection naming convention. | `qa_testing` |
| 0.6 | IDs + time + cursor | ULID prefixes (`r_` room, `pl_` player, `gi_` game-instance…), UTC time helpers, base64url cursor codec. | `qa_testing` |
| 0.7 | Logger upgrade | Structured logger with PII redaction; replace console shim. | `qa_testing` |

---

## Block 1 — Engine + Infra (the spine)

Builds the full design doc end-to-end. **No real games** — closed with two test games only.

| # | Item | Description | Status |
|---|---|---|---|
| 1.1 | Engine constants | `GameCategory`, `GameMode`, `EffectKind`, `AudienceKind`, `SystemActionType`, `GameId`, `SessionEventKind` as-const POJOs (doc §0.5). | `qa_testing` |
| 1.2 | Room state model | In-memory `Room`: lifecycle (lobby → in_game → lobby), players, spectators, host, reconnect tokens, idle clock (PRD §4). | `qa_testing` |
| 1.3 | Room registry | Create/get/GC rooms, 6-char collision-safe code generation, 30-min idle teardown; Redis write-through (PRD §4). | `qa_testing` |
| 1.4 | Redis snapshots + recovery | Self-sufficient snapshot (`gameId,seed,players,state,timers,pendingRefs`) + room snapshot; **`SessionManager.recoverAll()`** rebuilds rooms + in-flight games on boot (doc §6, PRD §12 "≤30s"). | `qa_testing` |
| 1.5 | Socket.IO gateway | Pure-transport gateway: three roles (host/player/display), Zod-validated protocol, reconnect-into-seat; injects sink into SessionManager. | `qa_testing` |
| 1.6 | Per-player rate limit | Token-bucket per player; gate before dispatch (PRD §14). | `qa_testing` |
| 1.7 | GamePlugin contract | The `GamePlugin<Config,State,Action,Content>` interface, `InitInput`, contexts; `init` returns `StepResult` (doc §2). | `qa_testing` |
| 1.8 | Effects + execution | `Effect` union + runtime executor (broadcast/toPlayer/toDisplay, timers, persist, request*, lifecycle); capability gating (doc §3). | `qa_testing` |
| 1.9 | GameRuntime loop | The action/tick → onAction/onTick → effects → view → fanout → snapshot loop (doc §7). | `qa_testing` |
| 1.10 | Timer subsystem | Runtime-owned clock keyed by absolute `fireAt`; `onTick` dispatch; recovery-safe (doc §0,§6). | `qa_testing` |
| 1.11 | view() fanout | Audience-projected views (host/display/player/spectator), server-side answer-secrecy + rating gating (doc §2.3). | `qa_testing` |
| 1.12 | Scoring + RoundScore | `scoreRound → RoundScore{deltas,maxPoints}`; raw leaderboard (doc §4). | `qa_testing` |
| 1.13 | Single + Session mgr | `SingleSession` lifecycle + `SessionManager` (engine layer, owns sessions, create/get/end, recoverAll) (doc §1, §4). | `qa_testing` |
| 1.14 | League session | Game queue, percent-of-max normalization, weighted aggregate (sum/avg/top-3), auto-advance (doc §4, PRD §7.3). | `qa_testing` |
| 1.15 | Config system | Per-game config schema mechanism via Zod `.default()` (host `{}` → full defaults, partial merges) — built per-game with each game spec (PRD §7). | `qa_testing` |
| 1.16 | Content service | **DEFERRED — blocked on game design.** Content schemas can't be invented before games exist; building them would design games through the back door. Built alongside the first game specs. | `blocked` |
| 1.17 | Validation seam | Abstract `REQUEST_VALIDATION` Effect + runtime execution **stub** that re-enters as a synthetic action; concrete payload deferred (doc §5,§10). | `qa_testing` |
| 1.18 | AI seam | Abstract `REQUEST_AI` Effect + runtime execution **stub**; rubric=Mongo, prompt=env; concrete payload deferred (doc §5,§10). | `qa_testing` |
| 1.19 | Game-play persistence | **NEXT PHASE.** Persist game plays to Mongo via `PERSIST_EVENT` + a game-play record (for admin history, PRD §9). Game-agnostic. | `todo` |
| 1.20 | Observability | Structured per-session event log (size-not-contents), metric hooks (snapshot rate, timer drift, AI/validation latency, recovery-overtake ratio) (doc §9). | `qa_testing` |
| 1.21 | Room HTTP edge | `POST /rooms` create + display/join URLs; join/lobby; **`POST /rooms/:code/start`** via SessionManager (PRD §4/§10). | `qa_testing` |
| 1.22 | Test game A (simultaneous) | `test_simultaneous` plugin — proves the contract (doc §8). | `qa_testing` |
| 1.23 | Test game B (round-robin) | `test_round_robin` plugin — re-armed timer + async validation re-entry (doc §8). | `qa_testing` |
| 1.24 | Block 1 closure | Both test games run E2E through the runtime; contract closed. **Recovery + SessionManager layering added post-review.** | `qa_testing` |

---

## Block 2 — Admin

First-class product surface (PRD §9). **Split: half is game-agnostic and buildable now; half is
blocked on game design** (you can't author content / tune rubrics for games that don't exist).

| # | Item | Description | Status |
|---|---|---|---|
| 2.1 | Admin auth | JWT access+refresh (refresh-reuse revokes). One-shot idempotent `POST /admin/seed`, env-gated (`CAN_SEED_ADMIN`), server-generated password returned once, 409 thereafter. Game-agnostic. | `todo` |
| 2.2 | Game-play history + viewer | Admin-only cursor-paginated read over persisted plays + per-session event timeline (doc §9.2). Game-agnostic (consumes 1.19 + observability). | `todo` |
| 2.3 | Content authoring | **DEFERRED — blocked on game design.** CRUD per game for decks/words/questions/cases needs the per-game content schemas, which only exist once games are specced. | `blocked` |
| 2.4 | Rubric recalibration | **DEFERRED — blocked on the AI game.** Edit AI scoring rubric in Mongo; only meaningful once Plead Your Case exists (doc §0, PRD §8). | `blocked` |

---

## ▶ NEXT PHASE — Game-Agnostic Admin Slice

**Strategy (decided with the user):** keep building **infra until forced to touch games** — exhaust
everything buildable *without* inventing game content schemas, then games become the unavoidable
next step on a complete base. Building content/authoring now would design games through the back
door, so those wait for spec-first game design (one game at a time, reviewed hard).

**In scope (game-agnostic only):**

| # | Item | Sub-items | Decisions locked | Status |
|---|---|---|---|---|
| 1.19 | Game-play persistence | `PERSIST_EVENT` → Mongo `session_events` (size-not-contents); on game-end write a `game_plays` record (room, gameId, players[id+nick], startedAt/endedAt, finalBoard). Cursor-paginated reads. | Persist **record + event stream** | `todo` |
| 2.1 | Admin auth | `Admin` model (email, password hash); `POST /admin/seed` (idempotent, env-gated `CAN_SEED_ADMIN`, returns server-generated password once, 409 after); `POST /admin/login` → JWT access+refresh; refresh rotation + reuse-revoke; admin auth middleware. | **JWT** + **one-shot seed endpoint** | `todo` |
| 2.2 | History + event viewer | `GET /admin/game-plays` (cursor list), `GET /admin/game-plays/:id`, `GET /admin/sessions/:instanceId/events` (timeline). Admin-auth gated. | Built on 1.19 + §9 stream | `todo` |

**Explicitly deferred (NOT omissions — blocked on games):** Content service (1.16), content
authoring (2.3), rubric recalibration (2.4). All wait for the first game spec to define real
schemas.

**Exit condition:** with this slice done, nothing meaningful remains buildable game-agnostically →
**the forced next step is spec-first game design** (Block 3), on a base with engine + recovery +
persistence + admin auth + history all real.

**New env:** `CAN_SEED_ADMIN`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
**New Mongo collections:** `admins`, `game_plays`, `session_events`.
**Open confirm:** seed endpoint returns a server-generated password in the response body (the one
place we don't redact it in the response; logs still redact). Confirm before build.

---

## Block 3 — Game plugins (×18)

Built only after Block 1 is closed. Each game = its own spec doc (reviewed hard) → plugin →
QA. Ordered by mechanic complexity, not PRD number. **All start `spec_needed`.**

> Note: the 2 test games (1.22/1.23) are likely two of these promoted to real catalogue games
> once the contract is proven — to be decided when Block 1 closes.

| # | Wave | Games | Description | Status |
|---|---|---|---|---|
| 3.A | A — simultaneous | Quizzes, Bible Quiz, Missing Letters, Spelling Fast, Typing Fast | simplest path; some need TTS | `spec_needed` |
| 3.B | B — ranked simultaneous | Scrambled Word, Definition Race, Synonyms, Antonyms, Wordshot | live ranking + validation service | `spec_needed` |
| 3.C | C — round-robin / real-time | Word Bomb, Truth or Dare, Presentation, Millionaire | turns, timers, lifelines | `spec_needed` |
| 3.D | D — submit + reveal/vote | Catch the Lie, Hot Take Court | submission then anonymous reveal/vote | `spec_needed` |
| 3.E | E — immersive (AI) | Investigation, Plead Your Case | heaviest; AI scoring + case content | `spec_needed` |

*(Sketch & Guess removed — drawing game cut for now.)*

---

## Block 4 — League polish

| # | Item | Description | Status |
|---|---|---|---|
| 4.1 | Queue configurator | Ordered game queue with per-game configs (PRD §7.3). | `todo` |
| 4.2 | Aggregate cadence | Cross-game leaderboard cadence + final-winner display modes (PRD §7.3). | `todo` |

---

## Block 5 — Host accounts & history

| # | Item | Description | Status |
|---|---|---|---|
| 5.1 | Host auth | Optional email+password (minimal PII, PRD §9). | `todo` |
| 5.2 | Saved presets | Game presets, custom content libraries, league templates, history (PRD §9). | `todo` |

---

## Block 6 — Resilience hardening

| # | Item | Description | Status |
|---|---|---|---|
| 6.1 | Reconnect + host-leave | Player refresh re-enters seat; host-leave suspends 60s then ends; mid-game leave auto-skips + preserves score (PRD §10). | `todo` |
| 6.2 | Recovery tuning | Snapshot cadence vs ≤30s budget; "reconnecting" UX protocol; 2G/3G payload minimisation (PRD §11/§12). | `todo` |
| 6.3 | Load testing | Ingestion-burst tests (15 players simultaneous); rate-limit tuning (PRD §14). | `todo` |
