# Backend QA Test Plan — Game Engine + Room Infra (Block 0 + Block 1)

**Author:** Backend QA
**Date:** 2026-05-31
**Branch:** main
**Tests against:** [`docs/qa/backend/game-engine-handoff.md`](./game-engine-handoff.md) ·
[`docs/backend/game-engine.md`](../../backend/game-engine.md) · PRD (`dockito/projects/gbedity/prd.md`)
**Base URL:** `http://localhost:8090/api/v1` · **WebSocket:** Socket.IO at `http://localhost:8090`

> **Scope.** This slice is the **engine + room infrastructure**, proven by two throwaway test games
> (`test_simultaneous`, `test_round_robin`). There is no admin, no host accounts, no real catalogue,
> no Mongo persistence of plays, and validation/AI are stubs. I test the **contract and the
> invariants** the design doc promises — not game content. Where the handoff marks something a
> known gap, I do **not** file it as a bug; I do test that the *seam* behaves as documented.
>
> The thing under test is unusual: most of the system is a **pure state machine** driven by a
> runtime. So the plan is weighted toward **engine-level invariants** (purity, determinism,
> serializability, answer-secrecy, recovery, the league seam) verified deterministically, plus the
> thin HTTP/WS edge verified by execution.

---

## 0. How this plan is organized

- **Mode 1 — Source audit findings (§1).** Read before running anything. Each is a hypothesis with
  an exact assertion to confirm or refute. Severity is my pre-execution estimate; execution
  confirms or downgrades.
- **Mode 2 — Execution suites (§2–§11).** Grouped by surface. Each case: preconditions, steps
  (exact curl / Jest harness / Socket.IO), exact expected (status, code, shape, *and* state).
- **§12** — cross-cutting checks. **§13** — environment & how to run. **§14** — exit criteria.

Assertions are **exact**. `status < 500` is not an assertion. I assert exact HTTP status, exact
`error.code`, exact response shape, and the resulting **state** (runtime state / leaderboard /
Redis snapshot / fanned-out view), because the data layer is ground truth.

---

## 1. Mode 1 — Source-audit findings (verify before execution)

I read every route, service, the runtime, sessions, room registry, gateway, snapshot/recovery, and
both test plugins. Conventions are clean (ServiceResult everywhere, no `res.json` in handlers,
`asyncHandler` on every route, message keys, no inline variant strings, no `z.any()`). The findings
below are about **behavior**, not style. Each becomes a test case in §2–§11.

| ID | Location | Finding | Sev (pre) | Confirms via |
|----|----------|---------|:---------:|--------------|
| SA-01 | `room-registry.ts:105` `sweepIdle()` + `server.ts` | `sweepIdle()` exists but **nothing ever calls it** — no `setInterval`, no scheduler. The handoff lists "Room idle > 30 min → swept" as expected behavior; as written, idle rooms are **never** reaped. PRD §4 requires the 30-min teardown. | **P1** | EX-IDLE-1 |
| SA-02 | gateway `index.ts` (disconnect) + PRD §10 | **Host-leave 60s suspension is not implemented.** PRD §10: "If the host leaves, the room is suspended for 60 seconds — if the host doesn't return, the room ends." On host socket disconnect the code only flips `connected=false`. No suspension, no room-end. | **P1** | EX-HOST-LEAVE-1 |
| SA-03 | `rooms.service.ts:85` `startGame` | Min-player check is `room.players.length < min`. `players` includes the **host** and any **disconnected** seats. PRD §6 "Min N" means N *players*; whether the host counts and whether disconnected seats count is unspecified here — and **max/overflow is not enforced at all** (no check against `manifest.players.max`). PRD §4/§7.1 require overflow handling above a hard cap. | **P1** (overflow) / **P2** (counting) | EX-START-CAP-1/2 |
| SA-04 | runtime `game-runtime.ts:290` `rehydrate` | On recovery, missed timers fire via `fireTimer` **inside** the rehydrate loop, each running `applyStep` (which broadcasts + schedules a snapshot), and *then* `rehydrate` broadcasts again at the end. If a missed deadline drives the game to `GAME_ENDED`, `onGameEnded` runs **during** `recoverAll`'s iteration — which (for recovered sessions) calls `sessionManager.end(code)` while the recovery loop may still be iterating snapshots. Risk: double-broadcast, end-during-recovery re-entrancy, snapshot deleted mid-loop. | **P1** | EX-REC-3, EX-REC-4 |
| SA-05 | runtime `game-runtime.ts:221` `startTimer` | Recovery re-arms a future timer with `delay = max(0, fireAt - now)`. Correct. But a timer whose `fireAt` already passed is fired via `fireTimer`, which reads `this.timers.get(key)` — and the timer was **never added** to the map during rehydrate (only `startTimer` adds). So `fireTimer` early-returns on a missed deadline ⇒ **missed deadlines do NOT fire on recovery.** This directly contradicts the handoff ("missed deadlines fire immediately") and the design doc §3/§6. | **P0** | EX-REC-2 |
| SA-06 | runtime `dispatchService` (§5) + `requireState` | An async verdict re-enters via `onAction` on resolve. If the game **already ended** (state advanced to DONE, session disposed) before the stub resolves, `applyStep`→`requireState` runs on disposed/`undefined` state or a terminal state. Verdict-after-end and verdict-after-dispose are untested. | **P2** | EX-ASYNC-3 |
| SA-07 | gateway `index.ts:113` host join | A `host` joining over WS is bound to the **host seat as a player** (`bindPlayer`), so the host receives the player projection on the host channel *and* a player projection. Also: **role is taken from the client** (`joinSchema.role`) with no verification that the socket is actually the host (no host token check on WS join). Any client can `client.join {role:"host"}` and bind to the host seat. | **P1** | EX-WS-AUTH-1 |
| SA-08 | gateway `index.ts:60` action | Spectators are **not modeled**. The runtime always fans out `spectator:false` and `startGame` passes **all** `room.players` to the plugin as participants. There is no over-cap partition, so PRD §4/§10 "spectators can't submit" cannot be exercised — and any joined player is a full participant. (Consistent with SA-03 overflow gap.) | **P2** | EX-SPEC-1 |
| SA-09 | `rooms.service.ts:50` join | Nickname uniqueness is **check-then-act** (`hasNickname` then `addPlayer`) with no atomic guard. Two near-simultaneous joins with the same nickname can both pass the check. Single-threaded Node makes this low-probability for HTTP (no `await` between check and push), but worth a concurrent-burst probe. | **P3** | EX-JOIN-RACE-1 |
| SA-10 | gateway `rate-limiter.ts` | Buckets are **never evicted** — `Map` grows one entry per player id forever (rooms churn, players leave, ids are ULIDs). Unbounded memory over time. Also `reset()` is never called from the gateway. | **P2** | EX-RATE-2 (note) |
| SA-11 | `ids.ts:20` `newRoomCode` | Room code uses `Math.random()` (fine — it's the runtime/infra, not a plugin; §6 forbids `Math.random` *in plugins* only). 6 chars over a 31-char ambiguity-free alphabet ⇒ ~887M space; `uniqueCode()` regenerates on clash. No issue — **confirm** collision handling under a forced clash. | **P3** | EX-CODE-1 |
| SA-12 | `single-session.ts` + `start-game` | `room.activeGame` is set **after** `sessions.create()` returns, and the game has already `init`-broadcast by then. If a client is mid-join during start there's a tiny window where the session exists but `room.activeGame` is null. Minor; verify lobby snapshot during/after start is consistent. | **P3** | EX-START-3 |
| SA-13 | `observability.ts` SessionEvent | `actionType`/`phaseFrom`/`phaseTo` are typed `string` (loose) at the log boundary — acceptable (engine can't know per-game enums). **Confirm** the size-not-contents rule: no question text / nickname / answer ever appears in an emitted `SessionEvent`. PRD §12 PII. | **P2** | EX-OBS-1 |
| SA-14 | runtime `guardCapability` | A plugin emitting an effect its manifest doesn't permit **throws** inside `execute` (synchronously, in `dispatchAction`'s call path) → the gateway catches it and emits `invalid_action`, but the **state has already advanced** (`applyStep` set `this.state` before iterating effects) and the snapshot is scheduled. So a capability violation leaves a half-applied transition. | **P2** | EX-CAP-1 |

---

## 2. HTTP edge — Room create / join / lobby

Base: `POST /rooms`, `GET /rooms/:code`, `POST /rooms/:code/players`.

| # | Test | Method + Path | Body | Expected |
|---|------|---------------|------|----------|
| EX-CREATE-1 | Create room (happy) | `POST /rooms` | `{"nickname":"Host"}` | **201**; `data.code` length 6, `[A-HJ-NP-Z2-9]` only; `data.hostId` `^pl_`; `data.hostToken` present; `display_url`/`join_url` contain the code. |
| EX-CREATE-2 | Empty nickname | `POST /rooms` | `{"nickname":""}` | **422** `validation_error` + `field_errors.nickname`. |
| EX-CREATE-3 | Whitespace nickname | `POST /rooms` | `{"nickname":"   "}` | **422** `validation_error` + `field_errors.nickname` (controller trims-then-checks via `requireString`). |
| EX-CREATE-4 | Missing nickname key | `POST /rooms` | `{}` | **422** `validation_error` + `field_errors.nickname`. |
| EX-CREATE-5 | Wrong type | `POST /rooms` | `{"nickname":123}` | **422** `validation_error` (non-string fails `requireString`). |
| EX-JOIN-1 | Join (happy) | `POST /rooms/:code/players` | `{"nickname":"Tobi"}` | **201**; `playerId` `^pl_`; `reconnectToken` present; lobby now lists 2 players. |
| EX-JOIN-2 | Unknown room | `POST /rooms/ZZZZZZ/players` | `{"nickname":"X"}` | **404** `room_not_found`. |
| EX-JOIN-3 | Duplicate nickname (case/space-insensitive) | join `"tobi "` after `"Tobi"` | — | **409** `nickname_taken` + `field_errors.nickname` (registry lowercases+trims). |
| EX-JOIN-4 | Empty nickname | join `{"nickname":""}` | — | **422** `validation_error` + `field_errors.nickname`. |
| EX-JOIN-5 | Code case-insensitivity | join using lower-case code | — | **201** (controller upper-cases `:code`). Confirm create returns upper-case and join lower-case both resolve. |
| EX-JOIN-6 | Join while `in_game` | start a game, then join | — | **409** `not_in_lobby`. Confirm code/message: service returns `NOT_IN_LOBBY` but reuses `MESSAGE_KEYS.rooms.CLOSED` — **flag the message-key mismatch** (P3 cosmetic). |
| EX-JOIN-7 | Soft cap | add 50 players, then 1 more | — | **409** `room_full` (cap = `ROOM_SOFT_CAP` 50, inclusive of host). |
| EX-LOBBY-1 | Lobby snapshot | `GET /rooms/:code` | — | **200**; `data.phase` ∈ {lobby,in_game,closed}; `players[]` only `{id,nickname}` — **no** `reconnectToken`, no `connected`, no `joinedAt` (PII/secret exclusion). |
| EX-LOBBY-2 | Lobby unknown room | `GET /rooms/ZZZZZZ` | — | **404** `room_not_found`. |
| EX-404-1 | Unknown route | `GET /api/v1/nope` | — | **404** `not_found` in `{error:{code,...}}` envelope (not Express default HTML). |
| EX-JOIN-RACE-1 *(SA-09)* | Concurrent same-nickname | fire 10× `POST players {"nickname":"Dup"}` in parallel | — | Exactly **1** succeeds (201), 9× **409** `nickname_taken`. Confirm lobby has no duplicate. |

---

## 3. HTTP edge — Start game (`POST /rooms/:code/start`)

Host-only; lobby phase; ≥ min players; known game id.

| # | Test | Body | Expected |
|---|------|------|----------|
| EX-START-1 | Happy (round-robin, 2 players) | `{hostId, gameId:"test_round_robin", config:{turnSeconds:10}, content:{prompt:"x"}}` | **201**; `instanceId` `^gi_`; `gameId:"test_round_robin"`; room flips to `in_game`; `activeGame` set; an init view fans out. |
| EX-START-2 | Non-host | valid body, `hostId:"pl_wrong"` | **403** `not_host`. |
| EX-START-3 *(SA-12)* | Lobby snapshot post-start | start, then `GET /rooms/:code` | `phase:"in_game"`; `activeGame.gameId` set; player list unchanged. |
| EX-START-4 | Unknown game id | `gameId:"nope"` | **404** `game_not_found`. |
| EX-START-5 | Below min players | start `test_round_robin` (min 2) with only host | **409** `not_enough_players`. |
| EX-START-6 | Already running | start twice | 2nd → **409** `game_already_running` (room no longer in lobby). |
| EX-START-7 | Unknown room | `POST /rooms/ZZZZZZ/start` | **404** `room_not_found`. |
| EX-START-8 | Missing hostId | omit `hostId` | **422** `validation_error` + `field_errors.hostId`. |
| EX-START-9 | Missing gameId | omit `gameId` | **422** `validation_error` + `field_errors.gameId`. |
| EX-START-10 | Bad config (schema) | `test_simultaneous` with `config:{secondsPerQuestion:-5}` | Plugin Zod rejects (`.positive()`). **Expected:** start fails cleanly. **Audit point:** `runtime.start()` calls `.parse()` which **throws**; this throw propagates through `sessions.create` → `startGame` (no try/catch) → `asyncHandler` → error middleware ⇒ **500 `internal_error`**, NOT a 422 validation envelope. **Flag as P2** — config/content validation should surface as a field-error 422, not a 500. |
| EX-START-11 | Bad content (schema) | `test_simultaneous` with `content:{}` (no `questions`) | Same as EX-START-10 — confirm whether it 500s or 422s. **This is the most likely real bug in the start path.** |
| EX-START-CAP-1 *(SA-03)* | At hard max | `test_round_robin` (max 10): join 11 players, start | **PRD-expected:** overflow handling (host-picks/random) selects ≤10; start succeeds with a 10-player roster. **Likely-actual:** no max check ⇒ all 11 passed to plugin as participants. Assert which, file gap vs bug accordingly. |
| EX-START-CAP-2 *(SA-03)* | Min counting | does host count toward min? does a disconnected seat count? | Document actual behavior; reconcile against PRD §6. |

---

## 4. Engine — Plugin purity & determinism (deterministic Jest, no I/O)

These prove the **one rule** (§0 of the design doc). Run against both test plugins directly (no
runtime) and via the runtime with a fake clock.

| # | Invariant | Method | Expected |
|---|-----------|--------|----------|
| EN-PURE-1 | `onAction` is pure | Call `plugin.onAction(state, action, ctx)` twice with deep-frozen `state`; deep-equal both results | Identical `StepResult`; input `state` **not mutated** (`Object.freeze` + assert no throw / no diff). |
| EN-PURE-2 | `onTick` is pure | Same for `onTick(state, now, ctx)` | Identical; no mutation. |
| EN-PURE-3 | `view` is pure & read-only | Call `view` for each audience twice | Identical patch; state untouched. |
| EN-PURE-4 | No clock access in plugins | grep both plugins for `Date.now`/`new Date`/`Date(` ; all time comes from `ctx.now`/`input.startedAt`/`now` arg | Zero matches. |
| EN-PURE-5 | No `Math.random` in plugins | grep both plugins for `Math.random` ; randomness only via `ctx.random`/`input.random` | Zero matches. (Runtime/ids may use it — plugins may not.) |
| EN-DET-1 | Seeded PRNG reproducible | `makeRandom("seed")` → first N draws; repeat with same seed | Identical sequence. Different seed ⇒ different sequence. |
| EN-DET-2 | Same seed ⇒ same timeline | Two runtimes, same seed + same scripted actions/ticks | Identical final state & identical view stream. |
| EN-SER-1 | State is JSON round-trippable | After init and after each transition: `deepEqual(state, JSON.parse(JSON.stringify(state)))` | Lossless — no `Date`, `Map`, `Set`, `undefined`-in-array, class instances, `BigInt`, functions. |
| EN-SER-2 | Deadlines are epoch-ms numbers | Inspect `state.deadline` (sim) / `state.deadline`,`turnStartedAt` (rr) | `typeof === "number"`, integer-ish epoch ms — never a `Date`. |

---

## 5. Engine — Runtime timers & the clock

Use Jest fake timers (`jest.useFakeTimers()`) so "now" is controlled; the runtime owns the clock,
so this is the right seam.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EN-TMR-1 | init arms a timer | start `test_simultaneous` `{secondsPerQuestion:20}` | A timer keyed `question` armed; not yet fired. |
| EN-TMR-2 | Timer fires `onTick` at deadline | advance fake clock to `fireAt` | `onTick` runs; phase `question→reveal`; `ROUND_ENDED` emitted → leaderboard applied. |
| EN-TMR-3 | Absolute deadline, not duration | start, advance clock by 5s, then to deadline | Fires once at the absolute `fireAt`, regardless of when armed. |
| EN-TMR-4 | `CLEAR_TIMER` cancels | round-robin: holder submits before timeout → `advanceTurn` clears `turn` timer | The old turn timer does **not** fire; a new one is armed. Assert no stray `onTick`. |
| EN-TMR-5 | `timer.drift_ms` metric | fire a timer late (advance clock past `fireAt`) | `metrics.timerDrift` emitted with `firedAt − fireAt ≥ 0`. |
| EN-TMR-6 | Dispose clears timers | `runtime.dispose()` then advance clock | No `onTick` fires after dispose; debounced snapshot timer also cleared (no open handle keeping the loop alive). |

---

## 6. Engine — Answer secrecy & view projection (the content-trust invariant)

This is the unbypassable-from-client guarantee (design §2.3, PRD §12). The **runtime never ships
state the `view` didn't emit** — so I assert on what the sink receives per audience.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EN-VIEW-1 | Target hidden from players during QUESTION | sim game, QUESTION phase; capture `PLAYER` and `DISPLAY` patches | Player patch has **no** `target` key; display patch also has none until REVEAL. Prompt present for both. |
| EN-VIEW-2 | Target revealed at REVEAL | advance to REVEAL | `target` present in display patch (and player patch — confirm intended: plugin adds `target` for all audiences at REVEAL). |
| EN-VIEW-3 | A player can't see others' answers | two players answer; capture each player's patch | Patch exposes only `answered:boolean` for self; **no** other players' `value`s anywhere in any player/display patch during QUESTION. |
| EN-VIEW-4 | `yourTurn` is per-player | round-robin; capture each player's patch | Only the current holder's patch has `yourTurn:true`; others `false`. |
| EN-VIEW-5 | View is the *only* channel | grep runtime: every client emit goes through `viewFor(audience)` → `plugin.view` | No `sink.send` path bypasses `view()`. (Static confirm + assert sink only ever receives `view()` output.) |
| EN-VIEW-6 | Rating filter reaches view | construct runtime with `ratingFilter:{tiers:["family"]}`; assert `ViewCtx.ratingFilter` passed to `view` | Plugin receives the filter (test plugins don't use it yet — confirm it's *threaded*, ready for real games). |

---

## 7. Engine — Scoring & the league seam (§4)

Pure-function and session-level. The seam is: plugin reports `{deltas,maxPoints}`; Single shows raw;
League normalizes to percent-of-max and weights.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EN-SCORE-1 | `scoreRound` raw deltas | sim: target 50, answers {48,90}; call `scoreRound` | deltas: player@48 → `max(0,100-2)=98`; player@90 → `max(0,100-40)=60`; `maxPoints:100`. |
| EN-SCORE-2 | Floor at 0 | answer 250 vs target 50 | delta points `0` (no negative). |
| EN-SCORE-3 | Leaderboard accumulates | apply two RoundScores | `pointsFor` sums; `max()` sums `maxPoints`; rows sorted desc. |
| EN-SCORE-4 | `percentFor` | totals 80, maxTotal 100 | `0.8`. With `maxTotal 0` ⇒ `0` (no divide-by-zero). |
| EN-LEAGUE-1 | Percent-of-max per game | LeagueSession, 2 games, known deltas/max | Each completed game stores `percentByPlayer` ∈ [0,1]. |
| EN-LEAGUE-2 | Weight multiplies percent | game weight 2× | aggregate contribution = `pct × 2 × 100`. |
| EN-LEAGUE-3 | Aggregate SUM | two games | sum of weighted percentage-points; rows sorted desc. |
| EN-LEAGUE-4 | Aggregate AVERAGE | two games | mean of weighted points; empty → 0. |
| EN-LEAGUE-5 | Aggregate TOP_3 | four games | sum of top 3 weighted points only. |
| EN-LEAGUE-6 | Same plugin, two consumers | run the *same* plugin output through Single (raw) and League (percent) | Single board = raw deltas; League = percent. Plugin code identical, unaware of league. |
| EN-LEAGUE-7 | PRD drift check | PRD §7.3 lists Sum/Average/**Top-3-games-count**/Custom; code has `sum/average/top_3` | `top_3` = top-3 **games** by score (matches "Top-3-games-count"); **Custom is not implemented** — confirm it's an intended gap, flag if PRD expects it in v1. Also: PRD §7.3 weights are 1×/2×/3× — confirm no validation forbids other weights (currently any `number`). |

---

## 8. Engine — Async services without async plugins (§5)

The synthetic-action loop. Validation stub always `ok:true`; AI stub `ok:false` unless key set.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EX-ASYNC-1 | Validation round-trips as synthetic action | round-robin: holder submits | `REQUEST_VALIDATION` emitted; plugin → `AWAIT_VALIDATION`; later a `{type:"system.service_result",ref,result:{ok:true,...}}` re-enters `onAction`; turn scored by hold-time; advance. |
| EX-ASYNC-2 | `ref` correlation | submit, capture `pendingRef` in state; assert synthetic action carries the **same** `ref` | Verdict with a non-matching `ref` is **ignored** (plugin guards `action.ref !== state.pendingRef`). |
| EX-ASYNC-3 *(SA-06)* | Verdict after game end / dispose | force the game to DONE (or `dispose`) before the validation promise resolves | **No crash**; verdict on terminal/disposed state is a safe no-op. Assert `requireState` doesn't throw post-dispose (or that dispatch is guarded). **This is an untested edge — likely to surface a bug.** |
| EX-ASYNC-4 | Capability gating — AI without `needsAI` | construct a probe plugin (or temporarily flag) that emits `REQUEST_AI` with `needsAI` unset | Runtime `guardCapability` **throws** → effect rejected. Confirm the error names the plugin + effect. |
| EX-ASYNC-5 | AI stub not configured | `REQUEST_AI` with `OPENAI_API_KEY` unset (needs `needsAI:true`) | Synthetic result `{ok:false,data:{reason:"ai_not_configured"}}` re-enters; plugin handles the degraded path without throwing. |
| EX-ASYNC-6 | `pendingRefs` tracked + cleared | inspect runtime `pendingRefs` while in flight, then after resolve | Ref present while pending; removed after resolve **and** after reject (both branches delete). |
| EX-ASYNC-7 | Service rejection | make the service promise reject | `pendingRefs` cleaned; error logged; **no** synthetic action injected; game not advanced. Confirm the plugin isn't left permanently stuck in `AWAIT_VALIDATION` with no path forward (document this as a resilience gap if so). |

---

## 9. Engine — Snapshot & recovery (§6, PRD §12) — the highest-risk area

Requires Redis up. This is where I expect the most bugs (SA-04, SA-05). I test the **runtime
rehydrate path directly** (deterministic, hand-built snapshots) *and* the full server-restart path.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EX-REC-1 | Snapshot is self-sufficient | start a game; read `gbedity:snapshot:<code>` from Redis | JSON carries `gameId, seed, players[], state, timers[], pendingRefs[], instanceId, snapshotAt`. Enough to rebuild with no other source. |
| EX-REC-2 *(SA-05)* | **Missed deadline fires on recovery** | Hand-build a snapshot whose `timers[0].fireAt` is in the **past**; `SingleSession.recover(...)` | **Design/handoff expects:** `onTick` fires immediately, state advances. **Suspected actual:** `rehydrate` calls `fireTimer(key)` but the timer was never `set` in the map during rehydrate, so `fireTimer` early-returns ⇒ **`onTick` never runs, deadline silently lost.** This is the **P0** to confirm first. If confirmed: missed deadlines are dropped on every recovery. |
| EX-REC-3 *(SA-04)* | Future timer re-armed | snapshot with `fireAt` in the future; recover; advance clock to it | Timer fires exactly once at the absolute deadline; no double-fire. |
| EX-REC-4 *(SA-04)* | Recovery that ends the game | snapshot near end whose missed tick would drive `GAME_ENDED` | If EX-REC-2 is fixed: `onGameEnded` fires during recovery → for a recovered session this calls `sessionManager.end(code)`. Assert no re-entrancy corruption of `recoverAll`'s loop (snapshot deleted while iterating `listActiveSnapshots`), no double-end. |
| EX-REC-5 | Identity preserved | recover | `instanceId` and `seed` equal the snapshot's (no new `gi_` minted) → PRNG timeline continues. |
| EX-REC-6 | Re-broadcast on recovery | recover with a recording sink | A view fans out to host+display+all players (reconnect "live" transition, PRD §10/§12). |
| EX-REC-7 | `pendingRefs` survive | snapshot with `pendingRefs:["r1"]`; recover | Refs restored into the runtime so a late verdict still routes (§5). |
| EX-REC-8 | Full server restart (Redis up) | create→join→start `test_simultaneous`; **kill** the node process mid-question; restart | `recoverAll` rebuilds the room (`gbedity:room:*`) **and** the in-flight game; room re-listed; clients reconnecting get a fresh view. Verify via a Socket.IO client reconnect after restart. |
| EX-REC-9 | Restart with Redis **down** | same, Redis stopped | Server boots; warning logged; room/game **not** recovered (documented, not a bug). |
| EX-REC-10 | `≤30s loss` budget | snapshot debounce is 1000ms; assert snapshots written within ~1s of a transition | A transition followed by ≥1s ⇒ a snapshot exists in Redis reflecting it. Worst-case loss ≪ 30s. |
| EX-REC-11 | Snapshot enumeration without `KEYS` | confirm recovery uses the `gbedity:snapshot:active` set, not `KEYS *` | `listActiveSnapshots` = `SMEMBERS`. (Static confirm — production-safety.) |
| EX-REC-12 | Stale active-set entry | put a code in the active set with no snapshot body (expired TTL) | `readSnapshot` → null ⇒ `continue`, recovery skips it without crashing. |
| EX-REC-13 | Recovery of unknown plugin id | snapshot with `gameId` not in registry | Logged "recovery skipped: unknown plugin"; not fatal; other recoveries proceed. |

---

## 10. WebSocket gateway — join, reconnect, roles, rate limit

Socket.IO client against `http://localhost:8090`. Events: `client.join`/`client.action` →
`server.joined`/`server.view`/`server.error`.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| EX-WS-1 | Display join | `client.join {roomCode, role:"display"}` | `server.joined`; joins display channel; receives broadcast `server.view` with `audience:"display"`. |
| EX-WS-2 | Player reconnect by token | join HTTP → `client.join {roomCode, role:"player", reconnectToken}` | Re-binds to the same seat; `connected=true`; receives player-audience views. |
| EX-WS-3 | Player join by playerId | `client.join {role:"player", playerId}` | Binds the seat by id (fallback path). |
| EX-WS-4 | Player join, no token/id | `client.join {role:"player"}` | `server.error {code:"seat_not_found"}`. |
| EX-WS-5 | Join unknown room | `client.join {roomCode:"ZZZZZZ", role:"display"}` | `server.error {code:"room_not_found"}`. |
| EX-WS-6 | Bad join payload | `client.join {role:"player"}` (no roomCode / wrong length) | `server.error {code:"bad_join"}` (Zod `safeParse` fail). |
| EX-WS-7 | Action before any game | join, `client.action` with no active session | `server.error {code:"no_active_game"}`. |
| EX-WS-8 | Bad action payload | `client.action {}` (no `action`) or not-bound socket | `server.error {code:"bad_action"}`. |
| EX-WS-9 | Action by non-bound (no `data.player`) | display sends `client.action` | `server.error {code:"bad_action"}` (display never bound a player). |
| EX-WS-10 | Invalid game action shape | bound player sends `{action:{type:"test_sim.answer"}}` missing fields | plugin `actionSchema.parse` throws → gateway catches → `server.error {code:"invalid_action"}`. **Also assert state did NOT advance** (cf. SA-14). |
| EX-WS-11 | Out-of-turn / late action ignored | sim: answer after REVEAL; rr: non-holder submits | Silently ignored — **no** `server.error`, no score, no state change (plugin returns `{state,effects:[]}`). |
| EX-RATE-1 | Rate limit | bound player sends >10 burst then sustained >5/sec | After bucket drains: `server.error {code:"rate_limited"}`; recovers after refill (~200ms/token). |
| EX-RATE-2 *(SA-10)* | Bucket lifecycle (note) | (observational) | Document: buckets never evicted; `reset` unused. Memory-growth note, not a play-blocking bug. |
| EX-WS-AUTH-1 *(SA-07)* | **Host role is client-asserted** | a non-host client sends `client.join {role:"host"}` | **Suspected:** it binds to the host seat with no host-token check. Confirm; if so, **P1** — any client can impersonate the host over WS. (Contrast: HTTP `start` *does* verify `hostId`.) |
| EX-DISC-1 | Disconnect flips connected | bound player disconnects | `room.players[i].connected=false`; seat retained; reconnect by token re-binds. |
| EX-HOST-LEAVE-1 *(SA-02)* | Host leaves | host socket disconnects, doesn't return | **PRD §10:** room suspended 60s then ends. **Suspected actual:** only `connected=false`; **no suspension, no end.** Confirm → **P1** functional gap vs PRD. |

---

## 11. End-to-end playable loops (the integration proof)

Full flow over HTTP + WS, both test games. This is the "thing to verify" from the handoff.

| # | Test | Flow | Expected |
|---|------|------|----------|
| E2E-SIM-1 | Simultaneous full game | create → join (2) → WS join display+players → `start test_simultaneous {rounds:1, secondsPerQuestion:20}` with 1 question → players answer → wait for deadline | Init view to all; **target absent in player payload**; on deadline: reveal (target shown), score by closeness, `GAME_ENDED`, room returns to **lobby**, session removed. |
| E2E-SIM-2 | Multi-round | `{rounds:2}` with 2 questions | Two QUESTION→REVEAL cycles; leaderboard accumulates across rounds; ends after round 2. |
| E2E-RR-1 | Round-robin full game | create → join (2) → start `test_round_robin {turnSeconds:10}` | Only holder's submit accepted; validation re-enters; hold-time scored; turn advances; after last player → `ROUND_ENDED`+`GAME_ENDED`; back to lobby. |
| E2E-RR-2 | Turn timeout | holder never submits | `onTick` at `turnSeconds` → score 0 for that turn, advance to next holder. |
| E2E-RR-3 | Non-holder blocked | non-holder submits during another's turn | Ignored; holder unchanged; no score. |
| E2E-LEAGUE-1 | League (engine-level) | drive a `LeagueSession` through 2 queued games (no HTTP configurator exists — handoff gap) | Sequential start; per-game percent; aggregate per mode; `isComplete` true at end. *(Engine class only; no WS/HTTP path — documented gap.)* |

---

## 12. Cross-cutting checks

| # | Check | How | Expected |
|---|-------|-----|----------|
| X-01 | Success envelope shape | every 2xx | `{data:...}` (+ `meta` only when present). Never a bare object. |
| X-02 | Error envelope shape | every 4xx/5xx | `{error:{code,message}}` (+ `field_errors` when present). Client-switchable `code`. |
| X-03 | Error code is a known constant | each error | `code` ∈ `ERROR_CODES`. Never a status-only or message-only signal. |
| X-04 | IDs prefixed | all id fields | players `pl_`, instances `gi_`. Opaque. |
| X-05 | No secret/PII in responses | lobby + create + join | No `reconnectToken` in **lobby** (it's only returned to the owner at create/join), no `connected`/`joinedAt` leaked, no email (none exist). PRD §12: nickname is the only player PII. |
| X-06 *(SA-13)* | Observability is size-not-contents | capture emitted `SessionEvent`s during a full game | Only `roomCode, instanceId, seq, at, kind, actorId, actionType, effectKind, stateBytes`. **No** prompt text, answer values, nicknames, targets. `seq` strictly monotonic per instance. |
| X-07 | No `console.log` in prod paths | grep `src` excl. tests | Zero (logger only). |
| X-08 | `asyncHandler` on every async route | grep `rooms.routes.ts` | All 4 routes wrapped. |
| X-09 | Services never throw for domain failures | grep services for `throw` | None for expected outcomes (ServiceResult used). Confirm `startGame` config-parse throw (EX-START-10) is the one place a throw escapes — file it. |
| X-10 | Money/precision | n/a this slice | No financial ops yet — noted for later blocks. |
| X-11 | CORS / headers | inspect | `helmet` on; CORS `*` (open by design for drop-in join). Note for prod hardening (P3). |

---

## 13. Environment & how to run

```bash
pnpm install
# Unit/integration (deterministic — no Redis/Mongo needed for §4–§8, most of §9):
nx test backend
# or a single suite:
nx test backend -- --testPathPattern=recovery

# Full execution (§2,3,10,11 + Redis-backed §9):
docker run -d -p 27017:27017 mongo:7         # MONGO_URL
docker run -d -p 6379:6379 redis:7           # REDIS_URL (required for recovery)
nx dev backend                                # http://localhost:8090
```

| Var | Value | Needed for |
|-----|-------|-----------|
| `PORT` | 8090 | all |
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | boot (not exercised by logic) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | snapshot/recovery (§9) |
| `WEB_BASE_URL` | `http://localhost:5173` | `display_url`/`join_url` assertions |
| `OPENAI_API_KEY` | unset (default) | AI degraded-path test (EX-ASYNC-5) |

**No seed script** — players are created via the join endpoint (no accounts). Test data is built
per-test (fresh `RoomRegistry`/`SessionManager` in unit harnesses; real endpoints for E2E).

**Tooling:** Jest (+ `supertest` for HTTP, already used). For WS I'll add a `socket.io-client`
harness. For recovery I'll drive `SingleSession.recover` with hand-built snapshots (deterministic)
**and** do one real kill-restart against Redis.

**Guardrails I hold to:** real Redis for recovery (never mock it for the integration pass); exact
assertions (no `< 500`); contract-parse every WS/HTTP response shape; always test missing-field,
wrong-type, expired/again, out-of-turn, duplicate, and the degraded service path.

---

## 14. Execution order & exit criteria

**Order (highest-risk first):**
1. **§1 source findings** — confirm/refute SA-05 (P0), SA-04, SA-01, SA-02, SA-07 first.
2. **§9 recovery** — the P0/P1 cluster lives here.
3. **§4–§8 engine invariants** — deterministic, fast, high-value.
4. **§2–§3 HTTP edge**, **§10 WS**, **§11 E2E**.
5. **§12 cross-cutting** sweep.

**Severity rubric:** **P0** breaks the documented contract (e.g. recovery drops deadlines) ·
**P1** functional gap vs PRD or auth/lifecycle hole · **P2** wrong status/shape, untested degraded
path, resource leak · **P3** cosmetic / message-key mismatch / prod-hardening note.

**Exit criteria for this slice:**
- All §4–§8 engine-invariant cases pass (purity, determinism, serializability, answer-secrecy,
  scoring/league seam, async re-entry) — these are the contract.
- §9 recovery: SA-05 resolved and EX-REC-2/3/4/8 pass against real Redis.
- §2/§3/§10/§11 happy + negative paths return **exact** documented codes/shapes.
- Every §1 finding is either fixed, or accepted-and-documented as a known gap with a tracked ticket.
- No P0/P1 open. P2/P3 may ship with tickets if explicitly accepted.

**Known gaps I will NOT file as bugs** (per handoff): validation/AI are stubs; no Mongo play
persistence; no admin/host-accounts/catalogue; observability is stdout-only; league has no
HTTP/WS configurator; tests were minimal by request. I *will* test that each seam behaves as the
handoff says it does.
```
