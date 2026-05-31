# Backend QA Report — Game Engine + Room Infra (Block 0 + Block 1)

**Author:** Backend QA
**Date:** 2026-05-31
**Against:** [`game-engine-test-plan.md`](./game-engine-test-plan.md) ·
[`game-engine-handoff.md`](./game-engine-handoff.md) · [`docs/backend/game-engine.md`](../../backend/game-engine.md) · PRD
**Mode:** report-only (no engine source changed). All scratch QA probe tests were removed after the run.

---

## 0. Test environment (as run)

- **Server:** `nx dev backend` on `:8090`, real **Redis** (`redis://127.0.0.1:6379`) + **Mongo**
  (`mongodb://127.0.0.1:27017`), both native (Docker daemon was down).
- **HTTP:** live `curl` against `/api/v1`. **WebSocket:** real `socket.io-client@4.8.3` driven from an
  isolated `/tmp` dir (no repo dependency added). **Engine invariants:** deterministic Jest probes
  (fake timers, hand-built snapshots) — removed after capturing results.
- **Recovery:** verified three ways — runtime `rehydrate`, `SessionManager.recoverAll` against real
  Redis, and a **real process kill -9 → restart**.
- Baseline before testing: `nx test backend` → **8/8 pass, 5 suites** (matches handoff).

> **Repo-state note (surfaced, not a bug):** the working tree is **ahead of `HEAD`** — the backend
> engine/room work is partly uncommitted (e.g. `server.ts` recovery wiring, `gateway/index.ts`,
> `single-session.ts`, removal of `GATEWAY_UNAVAILABLE`). The session-start git snapshot predated
> this work, so it listed only UI files. I confirmed the findings-relevant files
> (`game-runtime.ts`, `simultaneous.plugin.ts`, `room-registry.ts`) are **unchanged in the worktree**
> — i.e. **everything below was tested against the current on-disk code**, which is what the server
> ran. Recommend committing the in-flight backend work so QA and dev are pinned to the same SHA.

---

## 1. Verdict

The engine **contract holds where it counts**: plugin purity, JSON-serializability, seeded-PRNG
determinism, server-side answer secrecy, the league percent-of-max seam, async-via-synthetic-action
re-entry, the HTTP envelope, error codes, rate limiting, and **room+game recovery across a real
crash**. These are solid and I'd sign off on them.

But there are **two P0 / four P1** issues that break documented behavior or PRD requirements. The
headline: a **single-game `test_simultaneous` session never ends** (hangs in `reveal`), and
**recovery silently drops any timer deadline that elapsed while the server was down** — the exact
"lose ≤30s" guarantee recovery exists to provide. Both are squarely inside the engine's own
contract-prover, so they block sign-off on the slice as "engine contract proven end-to-end."

| Sev | Count | IDs |
|-----|-------|-----|
| **P0** | 2 | BUG-01 (sim game never ends), BUG-02 (recovery drops missed deadlines) |
| **P1** | 4 | BUG-03 (idle sweep never runs), BUG-04 (host-leave suspension missing), BUG-05 (WS host impersonation), BUG-06 (config/content errors → 500) |
| **P2** | 3 | BUG-07 (half-applied transition on capability throw), BUG-08 (stuck on validation failure), BUG-09 (rate-limiter buckets never evicted) |
| **P3** | 1 | BUG-10 (wrong message on `not_in_lobby`) |

PASS areas (no defects): §2 HTTP edge, answer secrecy, scoring/league math, async re-entry, real
crash recovery of rooms+games, observability size-not-contents, rate limiting. See §4.

---

## 2. Confirmed defects

### BUG-01 — `test_simultaneous` never ends; room stuck `in_game` forever — **P0**

**Where:** `engine/test-games/simultaneous.plugin.ts` `onTick` (QUESTION→REVEAL branch).
**What:** When the question timer fires, `onTick` transitions `question → reveal` and emits
`BROADCAST` + `ROUND_ENDED` — but **arms no timer** for the `reveal → done` step. The only thing
that advances `reveal → done` is another `onTick`, and nothing schedules one. The game sits in
`reveal` permanently; `GAME_ENDED` never fires; the room never returns to `lobby`.

**Repro (live):** create room + 2 players → `POST /start test_simultaneous {rounds:1, secondsPerQuestion:2}` →
poll `GET /rooms/:code`:
```
t=0s phase=in_game ... t=5s phase=in_game   (never returns to lobby)
```
**Repro (deterministic):** fake-timers; after the 2s deadline fires, phase = `reveal`; +60s later
still `reveal`, `onGameEnded` never called.

**Expected (handoff §"Full playable loop", step 6):** "the runtime auto-reveals, scores, and the
game ends → room returns to `lobby`." **Actual:** stops at reveal, no end, no lobby return.

**Blast radius:** every single-game simultaneous session leaks a live runtime + Redis snapshot that
never disposes; combined with BUG-03 (idle sweep never runs) these rooms accumulate forever. During
testing this alone produced 5–6 orphaned `in_game` rooms in Redis. Round-robin is **not** affected —
it emits `GAME_ENDED` directly from `advanceTurn` and ends correctly (verified).

**Likely fix:** in the QUESTION→REVEAL `onTick`, also `START_TIMER` a short reveal-hold deadline (or
emit `GAME_ENDED`/advance directly when it's the last question). This is the engine's *simultaneous
contract-prover*, so the fix should land before the slice is called "proven."

---

### BUG-02 — Recovery silently drops deadlines that elapsed during downtime — **P0**

**Where:** `engine/game-runtime.ts` `rehydrate()` → `fireTimer()`.
**What:** On recovery, for a timer whose `fireAt` is already in the past, `rehydrate` calls
`this.fireTimer(key)`. But `fireTimer` begins `const timer = this.timers.get(key); if (!timer) return;`
— and during rehydrate the missed timer was **never inserted** into `this.timers` (only `startTimer`
inserts, and the past-deadline branch doesn't call it). So `fireTimer` **early-returns**: `onTick`
never runs, the missed deadline is **silently lost**.

**Repro (3 ways, all agree):**
- Runtime `rehydrate` with a snapshot whose `timers[0].fireAt = now-5s`, phase `question`: after
  recovery phase is still **`question`** (expected `reveal`). Control: a *future* deadline correctly
  stays `question` and fires later.
- `SessionManager.recoverAll()` against real Redis with a past-deadline snapshot: recovered session
  phase = **`question`**.

**Expected (handoff Edge Cases + design §3/§6):** "missed deadlines fire immediately." **Actual:**
missed deadlines never fire. This **directly defeats the PRD §12 "lose ≤30s of state" guarantee** —
if the server is down across a question/turn deadline, that round never resolves on recovery.

**Note:** *future* timers re-arm correctly (verified), and rooms+games otherwise recover correctly
(see BUG-free crash test in §4). The defect is narrowly the **already-elapsed** deadline path — but
that's the whole point of recovery.

**Likely fix:** in `rehydrate`, for a past `fireAt`, insert the timer into the map before firing (or
call `onTick` directly without the `timers.get` guard) so the missed tick actually runs.

---

### BUG-03 — Idle rooms are never swept (30-min teardown not wired) — **P1**

**Where:** `engine/room/room-registry.ts` `sweepIdle()` + `server.ts`.
**What:** `sweepIdle()` is correct when called (verified: a room past `ROOM_IDLE_MS` is removed and
its snapshot deleted) — but **nothing ever calls it.** Static confirm: the only reference to
`sweepIdle` is its own definition; there is **no `setInterval`/scheduler anywhere** in the backend.
**Effect:** PRD §4 "the room persists until … idle for over 30 minutes" is not enforced; rooms (and,
with BUG-01, their orphaned snapshots) accumulate without bound.

**Repro:** `grep -rn sweepIdle` → 1 hit (the definition). `grep -rn setInterval src` → none.

**Likely fix:** schedule `roomRegistry.sweepIdle()` on an interval at boot (and dispose any active
session for swept rooms).

---

### BUG-04 — Host-leave 60s suspension / room-end not implemented — **P1**

**Where:** `engine/gateway/index.ts` `disconnect` handler.
**What:** On any socket disconnect the handler only flips `player.connected = false`. **PRD §10:**
"If the host leaves, the room is suspended for 60 seconds — if the host doesn't return, the room ends
and players are shown the final state." There is no host-specific path: no suspension timer, no
room-end, no notification. A host closing their tab leaves the room running indefinitely.

**Repro:** static — disconnect handler has no `hostId` branch; no suspension state on `Room`.

**Likely fix:** on host-socket disconnect, mark the room suspended + arm a 60s timer that ends the
room (and broadcasts final state) unless the host reconnects.

---

### BUG-05 — WebSocket host role is client-asserted (host impersonation) — **P1**

**Where:** `engine/gateway/index.ts` `handleJoin` (HOST branch); `gateway/protocol.ts` `joinSchema`.
**What:** A client joins with `{ role: 'host' }` and the gateway binds it to the host seat with **no
verification** — it never checks the host token/`reconnectToken`. Contrast the HTTP `start` path,
which *does* verify `hostId`. So anyone who knows only the 6-char room code can bind as host over WS.

**Repro (live, socket.io-client):** a fresh client with only the room code:
```
emit client.join { roomCode, role:'host' }  ->  server.joined { role:'host' }   (no error)
```
**Impact:** with in-game host controls (pause/skip/boot/end — PRD §9) eventually routed over WS, an
impostor could control the session. Room codes are shared verbally/QR, so "knows the code" is the
default, not a high bar.

**Likely fix:** require and verify the host `reconnectToken` (the value returned by `POST /rooms` as
`hostToken`) on a `role:'host'` WS join, same as the player seat-token check.

---

### BUG-06 — Bad game config/content returns 500 instead of a 422 validation envelope — **P1**

**Where:** `features/rooms/rooms.service.ts` `startGame` → `SessionManager.create` →
`SingleSession.start` → `runtime.start` → `plugin.configSchema.parse()` / `contentSchema.parse()`.
**What:** The plugin's Zod schemas are parsed inside `runtime.start()`, which **throws** a raw
`ZodError` on invalid input. Nothing between there and the error middleware catches it, so the client
gets **500 `internal_error`** — a server-fault envelope for what is a client input error.

**Repro (live):**
```
POST /start test_simultaneous config:{secondsPerQuestion:-5}  -> 500 internal_error
POST /start test_simultaneous content:{}  (no questions)       -> 500 internal_error
```
**Expected:** **422 `validation_error`** with `field_errors` (consistent with every other validation
path in the service, which returns clean `ServiceError`s). This is the most user-facing of the
findings — a host fat-fingering a config gets "Something went wrong on our end."

**Likely fix:** validate config/content with `safeParse` in the service (or wrap `runtime.start`),
mapping Zod issues to `field_errors` + a 422 `ServiceError`.

---

### BUG-07 — Capability-guard throw leaves a half-applied transition — **P2**

**Where:** `engine/game-runtime.ts` `applyStep` / `execute` / `guardCapability`.
**What:** `applyStep` sets `this.state = step.state` **before** iterating effects. If an effect then
fails the capability guard (`guardCapability` throws), the state has already advanced but the
intended effects (timers, fanout) are half-run. Demonstrated by stripping `needsValidation` from the
round-robin plugin: a submit throws on `REQUEST_VALIDATION`, yet state moved `turn → await_validation`
and a snapshot was scheduled — an inconsistent, un-rolled-back state. (In normal operation the test
games declare correct capabilities, so this is latent; it bites the moment a real plugin emits an
effect it forgot to declare.)

**Likely fix:** validate/guard effects before committing `this.state`, or make `applyStep`
transactional (apply state only if all effects are admissible).

---

### BUG-08 — Validation failure / lost verdict strands the round in `await_validation` — **P2**

**Where:** `engine/game-runtime.ts` `dispatchService` (reject branch) + round-robin `onTick`.
**What:** If a `REQUEST_VALIDATION`/`REQUEST_AI` promise **rejects** (or never resolves), the runtime
deletes the `pendingRef` and logs — but injects **no** synthetic action, so the plugin stays in
`await_validation`. The round-robin `onTick` early-returns unless `phase === 'turn'`, so the turn
timer can't rescue it. There is **no path forward** — the holder's turn (and the game) is stuck.
With validation/AI being live network calls in real games, transient failures will hit this.

**Repro:** after a submit, state is `await_validation` with a non-null `pendingRef`; the only thing
that advances it is a successful verdict. Confirmed the stuck state; the reject path injecting nothing
is visible in `dispatchService.catch`.

**Likely fix:** on service failure, re-enter a synthetic `service_result` with `{ok:false}` (so the
plugin can advance/penalize), or have the runtime time-bound pending refs.

---

### BUG-09 — Rate-limiter buckets are never evicted — **P2**

**Where:** `engine/gateway/rate-limiter.ts`.
**What:** One `Bucket` per player id is created and **never removed** (`reset()` exists but is never
called; disconnect doesn't clear it). Player ids are per-room ULIDs and rooms churn, so the map grows
unbounded over the process lifetime. Not play-blocking, but a slow memory leak on a long-lived,
single-instance v1 server.

**Likely fix:** evict a bucket on player disconnect/room-end, or lazily drop buckets that have been
full (idle) past a TTL.

---

### BUG-10 — `not_in_lobby` returns the "room has closed" message — **P3 (cosmetic)**

**Where:** `features/rooms/rooms.service.ts` `joinRoom`.
**What:** Joining an in-game room correctly returns code `not_in_lobby` (HTTP 409) but reuses
`MESSAGE_KEYS.rooms.CLOSED` → message "That room has closed." The room hasn't closed; it's mid-game.
Code is correct (clients switch on code), only the human message is wrong.

**Repro (live):** `POST /rooms/:code/players` while `in_game` →
`{"code":"not_in_lobby","message":"That room has closed."}`.

**Likely fix:** add a `rooms.IN_GAME` message key ("That game's already underway.") and use it.

---

## 3. PRD / design-doc drift observed (informational)

- **League `Custom` aggregate not implemented.** PRD §7.3 lists Sum/Average/**Top-3-games-count**/
  **Custom**; code (`session.types.ts`) has `sum/average/top_3` only. `top_3` matches
  "Top-3-games-count." `Custom` is absent — confirm it's a deliberate v1 gap (handoff says league has
  no configurator yet, so likely fine to defer).
- **Game weight unvalidated.** PRD §7.3 weights are 1×/2×/3×; `LeagueEntry.weight` is any `number`.
  No validation forbids other values. Low risk while there's no configurator.
- **Word Bomb hold-time vs lives** — already flagged in design-doc §10.1 as a PRD-side cleanup; no
  engine impact this slice.

---

## 4. PASS — verified clean (no defects)

| Area | Cases | Result |
|------|-------|--------|
| HTTP create/validation | EX-CREATE-1..5 | 201 happy; 422 `validation_error` + `field_errors.nickname` for empty/whitespace/missing/wrong-type. |
| HTTP join | EX-JOIN-1..5 | happy 201; unknown→404 `room_not_found`; dup (case+space-insensitive)→409 `nickname_taken`; empty→422; lower-case code resolves. |
| HTTP lobby PII | EX-LOBBY-1, X-05 | Only `{id,nickname}` returned — **no** `reconnectToken`/`connected`/`joinedAt`. PRD §12 honored. |
| HTTP start (valid paths) | EX-START-1..9 | exact codes: 201 happy, 403 `not_host`, 404 `game_not_found`/`room_not_found`, 422 missing `hostId`/`gameId`, 409 `not_enough_players`, 409 `game_already_running`. Phase flips to `in_game`; `instanceId` `^gi_`. |
| Unknown route | EX-404-1 | 404 `not_found` in error envelope (not Express HTML). |
| Plugin purity | EN-PURE-1..3 | `onAction`/`onTick`/`view` don't mutate deep-frozen input. |
| Serializability | EN-SER-1..2 | state round-trips through JSON losslessly; deadlines are epoch-ms numbers. |
| Determinism | EN-DET-1 | same seed → identical PRNG sequence; different seed → different. |
| Answer secrecy | EN-VIEW-1..2 | players **never** receive `target` during QUESTION; display gets it at REVEAL. Server-side, unbypassable from client. |
| Async re-entry | EX-ASYNC-1..2 | validation verdict re-enters as `system.service_result`; `ref` correlation enforced (mismatched ref ignored). |
| Round-robin end | E2E-RR | times out twice → `done` → `onGameEnded` fires (room would return to lobby). |
| Rate limit | EX-RATE-1 | 30 rapid actions → 20 `rate_limited` (capacity 10 burst, 5/s refill). |
| Out-of-turn / dup | EX-WS-11 | silently ignored — no spurious `server.error`, no score, no state change. |
| WS joins | EX-WS-2/4/5/6/7 | reconnect-by-token binds seat; no-token→`seat_not_found`; unknown room→`room_not_found`; bad payload→`bad_join`; pre-game action→`no_active_game`. |
| **Crash recovery** | EX-REC-8 | **kill -9 → restart**: room `T8TFPN` recovered `in_game` with both players + nicknames; log: `redis connected → recovery complete {rooms,games} → listening`. Future timers re-arm. |
| Recovery robustness | EX-REC-12 | stale active-set entry (no body) skipped, not fatal. |
| Observability PII | X-06 | session events carry only `roomCode,instanceId,seq,at,kind,actorId,actionType,effectKind,stateBytes` — **no** prompt/nickname/answer/target. Size-not-contents holds. |

---

## 5. Recommended fix order

1. **BUG-02** (recovery drops missed deadlines) — defeats the core recovery guarantee; small fix.
2. **BUG-01** (sim game never ends) — blocks the simultaneous contract-prover; compounds resource leaks.
3. **BUG-03 + BUG-04** (idle sweep, host-leave) — PRD lifecycle gaps; needed for any real session hygiene.
4. **BUG-05** (WS host auth) — before host controls ship over WS.
5. **BUG-06** (config/content 500→422) — user-facing; clean ServiceError mapping.
6. **BUG-07/08/09** (transactional applyStep, validation-failure path, bucket eviction) — resilience.
7. **BUG-10** — message key, trivial.

**Re-test on fix:** I have deterministic repros for BUG-01/02/07/08 and live repros for
BUG-03/04/05/06/10; happy to re-run the full plan against the fix branch and confirm each closes.

---

## Dev response — fixes applied (2026-05-31)

All 10 findings confirmed as real (no misunderstandings) and fixed. **Build: Typecheck ✅ · Lint ✅
· Tests ✅ (10/10, 6 suites)** — includes 2 new P0 regression tests. Working tree only (not yet
committed — awaiting go-ahead). Ready for re-test.

| Bug | Fix |
|---|---|
| BUG-01 (sim never ends) | `onTick` now arms a `REVEAL` timer on QUESTION→REVEAL and handles REVEAL→next/DONE; added `revealSeconds` config (default 3). Regression test: `simultaneous.lifecycle.test.ts`. |
| BUG-02 (recovery drops missed deadlines) | Extracted `runTick()` (no map-membership guard); `rehydrate` calls it directly for elapsed deadlines instead of `fireTimer`. Regression test: `recovery.test.ts` "fires a missed deadline". |
| BUG-03 (idle never reaped) | `setInterval` sweeper in `attachRoomGateway` (60s, unref'd): `roomRegistry.sweepIdle()` → ends each swept room's session + clears suspension timer; also `limiter.sweepStale()`. |
| BUG-04 (host-leave) | New `RoomPhase.SUSPENDED` + 60s grace timer on host disconnect → `endRoom()` on expiry; cancelled if host re-joins. `server.room_suspended` / `server.room_ended` WS events. |
| BUG-05 (WS host unverified) | Host join now requires the `hostToken` (matched against the host seat's `reconnectToken`); fails `host_auth_failed` otherwise. |
| BUG-06 (config → 500) | `safeParse` config + content at the service boundary → 422 `validation_error` with `field_errors` (via `zodFieldErrors`); runtime `.parse()` kept as invariant. |
| BUG-07 (half-applied transition) | `assertEffectsAllowed()` pre-flight (capability check) runs **before** state commit in `applyStep`; per-effect guard removed. All-or-nothing. |
| BUG-08 (stuck-on-validation) | Submit clears the TURN timer + arms a bounded `VALIDATION` timer; `onTick` treats a validation-timeout like a turn-timeout (advance); `advanceTurn` clears both timers. `validationSeconds` config (default 5). |
| BUG-09 (rate buckets never evicted) | Bucket evicted on disconnect; periodic `sweepStale()` in the sweeper as a safety net. |
| BUG-10 (`not_in_lobby` message) | Added `rooms.NOT_IN_LOBBY` key ("That room's game is already in progress."); paired with the code. |

**Two meta-notes acknowledged:** (1) the working tree is still uncommitted — I commit only on the
owner's request, so it remains a working-tree change; recommend the owner commits a baseline + the
fix on top so QA can pin SHAs. (2) The orphaned `in_game` rooms were the BUG-01×BUG-03 interaction;
both are fixed, so the pileup stops.

---

## QA re-test — verification of fixes (2026-05-31, round 2)

**Verdict: all 10 fixes VERIFIED CLOSED. No regressions. Slice signed off pending commit.**

Re-ran independently against the worktree (the fix code on disk): real Redis + Mongo, real
`socket.io-client`, my own deterministic probes (not the dev's tests), and a **fresh real kill-restart
across an elapsed deadline**. Repo baseline confirmed **10/10, 6 suites**. Scratch probes removed
after the run; Redis cleaned; repo suite still 10/10 green afterward.

| Bug | Sev | How I re-verified | Result |
|---|---|---|---|
| BUG-01 | P0 | Deterministic: sim 1-round, fire 2s deadline → `reveal`, +60s → **`done`** + `onGameEnded`. **Live:** game returned to **`lobby` at t=5s** (2s Q + 3s reveal). | ✅ CLOSED |
| BUG-02 | P0 | Deterministic: past-deadline snapshot recovers to **`reveal`** (was stuck `question`); future-deadline control stays `question`. **Live kill-restart:** killed mid-question, stayed down past the 4s deadline, restarted → missed tick fired on recovery, game resolved to **`lobby`** by first poll. | ✅ CLOSED |
| BUG-03 | P1 | Static: `setInterval` sweeper (60s, unref'd) in `attachRoomGateway` calls `roomRegistry.sweepIdle()` + ends sessions + `limiter.sweepStale()` — confirmed wired at boot (was zero callers before). | ✅ CLOSED |
| BUG-04 | P1 | **Live WS:** host disconnect → room phase `suspended` + display received `server.room_suspended`; host re-join within grace → room back to **`lobby`** (suspension cancelled). | ✅ CLOSED |
| BUG-05 | P1 | **Live WS:** host join with **no** token → `host_auth_failed` (no join); **wrong** token → `host_auth_failed`; **correct** `hostToken` → joined as host. Impersonation closed. | ✅ CLOSED |
| BUG-06 | P1 | **Live HTTP:** bad config → **422** `validation_error` `field_errors.config.secondsPerQuestion`; bad content → **422** `field_errors.content.questions`. (Was 500.) | ✅ CLOSED |
| BUG-07 | P2 | Deterministic: ungated `REQUEST_VALIDATION` throws **and** phase is unchanged (`turn`→`turn`). Pre-flight rejects before state commit — no half-apply. | ✅ CLOSED |
| BUG-08 | P2 | Deterministic: stubbed validation to never resolve; submit → `await_validation`; +120s → VALIDATION timer fired `onTick` → turn advanced (`done`, turnIdx=1). No longer stranded. | ✅ CLOSED |
| BUG-09 | P2 | Static: bucket evicted on disconnect + `sweepStale()` safety net in the 60s sweeper. | ✅ CLOSED |
| BUG-10 | P3 | **Live HTTP:** join while `in_game` → `not_in_lobby` with message "That room's game is already in progress." (was "That room has closed."). | ✅ CLOSED |

**Regression check:** the two new dev regression tests (`simultaneous.lifecycle.test.ts`,
`recovery.test.ts` missed-deadline) plus my independent probes all agree — these P0s can't silently
return. PASS areas from round 1 (answer secrecy, scoring/league, async re-entry, crash recovery of
rooms+games, observability size-not-contents, rate limiting, HTTP edge) were unaffected by the
fixes and remain green.

**Sign-off:** the engine + room infra slice (Block 0 + 1) is **QA-passed** against the worktree.
One open action, not a code defect: **commit the fix** so QA and dev pin the same SHA (this report
verified the on-disk worktree, which is what the server ran).
