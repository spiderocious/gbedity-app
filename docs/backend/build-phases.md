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
| 0.1 | Response contract | Replace scaffold's flat `{error,message}` with `ResponseUtil` envelope (`{data}` / `{error:{code,message,field_errors}}`), `ServiceResult<T>`, `ERROR_CODES`, `asyncHandler`, global error middleware. | `todo` |
| 0.2 | Message-key registry | Central message catalog sliced per feature; no inline response strings. | `todo` |
| 0.3 | Request context | `AsyncLocalStorage` request context (request_id, role, etc.); services never see `req`. | `todo` |
| 0.4 | Redis client | Single Redis client for room snapshots + pub/sub; `REDIS_URL` env. | `todo` |
| 0.5 | Mongo confirm | Confirm existing Mongo client/`Db` access pattern; collection naming convention. | `todo` |
| 0.6 | IDs + time + cursor | ULID prefixes (`r_` room, `pl_` player, `gi_` game-instance…), UTC time helpers, base64url cursor codec. | `todo` |
| 0.7 | Logger upgrade | Structured logger with PII redaction; replace console shim. | `todo` |

---

## Block 1 — Engine + Infra (the spine)

Builds the full design doc end-to-end. **No real games** — closed with two test games only.

| # | Item | Description | Status |
|---|---|---|---|
| 1.1 | Engine constants | `GameCategory`, `GameMode`, `EffectKind`, `AudienceKind`, `SystemActionType`, `GameId` as-const POJOs (doc §0.5). | `doc_written` |
| 1.2 | Room state model | In-memory `Room`: lifecycle (lobby → in_game → lobby), players, spectators, host, reconnect tokens, idle clock (PRD §4). | `todo` |
| 1.3 | Room registry | Create/get/GC rooms, 6-char collision-safe code generation, 30-min idle teardown (PRD §4). | `todo` |
| 1.4 | Redis snapshots + recovery | Debounced snapshot of `{pluginId,state,timers,pendingRefs}`; rehydrate on restart, re-arm future timers, fire missed deadlines (doc §6, PRD §12 "≤30s"). | `todo` |
| 1.5 | Socket.IO server | Namespaced room sockets, three roles (host/player/display), Zod-validated typed protocol, reconnect-into-seat. | `todo` |
| 1.6 | Per-player rate limit | Token-bucket per player; runtime gate before plugin dispatch (PRD §14). | `todo` |
| 1.7 | GamePlugin contract | The `GamePlugin<Config,State,Action,Content>` interface, `InitInput`, contexts (doc §2). | `doc_written` |
| 1.8 | Effects + execution | `Effect` union + runtime executor (broadcast/toPlayer/toDisplay, timers, persist, request*, lifecycle); capability gating (doc §3). | `doc_written` |
| 1.9 | GameRuntime loop | The action/tick → onAction/onTick → effects → view → fanout → snapshot loop (doc §7). | `todo` |
| 1.10 | Timer subsystem | Runtime-owned clock keyed by absolute `fireAt`; `onTick` dispatch; recovery-safe (doc §0,§6). | `todo` |
| 1.11 | view() fanout | Audience-projected views (host/display/player/spectator), server-side answer-secrecy + rating gating (doc §2.3). | `todo` |
| 1.12 | Scoring + RoundScore | `scoreRound → RoundScore{deltas,maxPoints}`; raw leaderboard (doc §4). | `doc_written` |
| 1.13 | Single session | Lobby↔game lifecycle, one raw board, replay/pick-another/end (doc §1, PRD §4). | `todo` |
| 1.14 | League session | Game queue, percent-of-max normalization, weighted aggregate (sum/avg/top-3), auto-advance (doc §4, PRD §7.3). | `todo` |
| 1.15 | Config system | Universal + per-game config schema mechanism, defaults so host "next→start" (PRD §7). | `todo` |
| 1.16 | Content service | Mongo-backed decks/words/questions/cases; tagging (rating tier + tags); server-side rating filter that clients can't bypass (PRD §8/§12). | `todo` |
| 1.17 | Validation seam | Abstract `REQUEST_VALIDATION` Effect + runtime execution stub; concrete payload deferred (doc §10 item 2). | `spec_needed` |
| 1.18 | AI seam | Abstract `REQUEST_AI` Effect + runtime execution stub; rubric=Mongo, prompt=env; concrete payload deferred (doc §10 item 2). | `spec_needed` |
| 1.19 | Game-play persistence | Persist game plays to Mongo via `PERSIST_EVENT` (for admin history, PRD §9). | `todo` |
| 1.20 | Observability | Structured per-session event log (size-not-contents), metrics (snapshot rate, timer drift, AI/validation latency, recovery-overtake ratio) (doc §9). | `todo` |
| 1.21 | Room HTTP edge | `POST /rooms` create-room + display-URL surfacing; join/lobby end-to-end (PRD §4/§10). | `todo` |
| 1.22 | Test game A (simultaneous) | Spec doc + plugin: a simultaneous-answer game to prove the contract (doc §8). | `spec_needed` |
| 1.23 | Test game B (round-robin) | Spec doc + plugin: a round-robin game with a re-armed timer + async validation to prove the contract (doc §8). | `spec_needed` |
| 1.24 | Block 1 closure | Both test games pass E2E through the runtime (single + league); contract declared closed. | `blocked` |

---

## Block 2 — Admin

Needs Block 1 persistence + content + observability. First-class product surface (PRD §9).

| # | Item | Description | Status |
|---|---|---|---|
| 2.1 | Admin auth | Admin login (separate from host accounts). | `todo` |
| 2.2 | Game-play history | View persisted game plays; per-session event timeline (doc §9.2). | `todo` |
| 2.3 | Content authoring | CRUD per game for decks/words/questions/cases with rating tags (PRD §8). | `todo` |
| 2.4 | Rubric recalibration | Edit AI scoring rubric (criteria + weights) in Mongo; prompt shell stays env (doc §0, PRD §8). | `todo` |

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
