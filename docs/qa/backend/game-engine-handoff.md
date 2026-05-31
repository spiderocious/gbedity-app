# Backend QA Handoff — Game Engine + Room Infra (Block 0 + Block 1)

**Date:** 2026-05-31
**Branch:** main
**Build:** Typecheck ✅ · Lint ✅ · Tests ✅ (10/10, 6 suites) · QA round-1 fixes applied (see qa-report "Dev response")
**Base URL:** `http://localhost:8090/api/v1`
**WebSocket:** Socket.IO on the same origin/port (`http://localhost:8090`)
**Implements:** [`docs/backend/game-engine.md`](../../backend/game-engine.md) end-to-end + the Block 0
foundations it sits on. Tracker: [`docs/backend/build-phases.md`](../../backend/build-phases.md).

> **Scope note for QA:** this is the **engine + room infrastructure**, closed with **two throwaway
> test games** (`test_simultaneous`, `test_round_robin`) that exist only to prove the plugin
> contract. They are NOT catalogue games and have no real content. There is no admin, no host
> accounts, and no real game catalogue yet. Tests are intentionally **minimal smoke tests** — full
> coverage is a later pass.

---

## What's in this slice

| Area | Status |
|---|---|
| Response envelope (`ResponseUtil`), `ServiceResult`, error codes, message keys, `asyncHandler`, error middleware, request context | ✅ |
| Infra: Redis client (best-effort), ULID ids + 6-char room codes, time/cursor helpers, structured logger w/ PII redaction | ✅ |
| Engine: plugin contract, Effects, runtime loop, runtime-owned timers, view fanout, capability gating, seeded PRNG | ✅ |
| Redis snapshot + recovery (absolute-deadline timers, rehydrate) | ✅ |
| Scoring + Single/League sessions (percent-of-max league normalization) | ✅ |
| Async seams (validation/AI) — **stubs only**, re-enter as synthetic actions | ✅ (abstract) |
| Observability: per-session event log (size-not-contents) + metric hooks | ✅ |
| Socket.IO gateway: join/reconnect, roles, per-player rate limit, view fanout | ✅ |
| Room HTTP edge: create / join / lobby / **start** | ✅ |
| **SessionManager** (engine layer) owns sessions + boot-time `recoverAll()` | ✅ |
| **Server-restart recovery**: rooms + in-flight games rebuilt from Redis on boot | ✅ |

---

## Prerequisites

```bash
pnpm install
nx dev backend            # http://localhost:8090
```

- **MongoDB** at `MONGO_URL` — needed at boot (existing scaffold behaviour). Not exercised by this
  slice's logic (content/history persistence is later), but the server connects on start.
- **Redis** at `REDIS_URL` is **optional for play** but **required to test recovery**. If down, the
  server still boots and games still run; snapshots become best-effort (logged warning). With Redis
  up (`redis://127.0.0.1:6379`), rooms + in-flight games are written through and rebuilt on restart.
- No seed script — players are created on the fly via the join endpoint (no accounts in v1).

---

## Endpoints Implemented

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| GET | `/health` | none | — | unchanged scaffold health check |
| POST | `/rooms` | none | `{ "nickname": "Host" }` | creates a room; returns code + host token + display/join URLs |
| GET | `/rooms/:code` | none | — | lobby snapshot (phase + players) |
| POST | `/rooms/:code/players` | none | `{ "nickname": "Tobi" }` | join a room's lobby |
| POST | `/rooms/:code/start` | host | `{ "hostId", "gameId", "config?", "content?" }` | host starts a game; creates the session and begins fanning views over WebSocket |

### Response shapes

Success envelope: `{ "data": { ... } }`  ·  Error envelope: `{ "error": { "code", "message", "field_errors?" } }`

`POST /rooms` → **201**
```json
{ "data": { "code": "ABKM27", "hostId": "pl_01H…", "hostToken": "01H…",
            "display_url": "http://localhost:5173/display/ABKM27",
            "join_url": "http://localhost:5173/join/ABKM27" } }
```

`POST /rooms/:code/players` → **201**
```json
{ "data": { "code": "ABKM27", "playerId": "pl_01H…", "reconnectToken": "01H…" } }
```

---

## Manual test — HTTP

```bash
# create a room
curl -sX POST localhost:8090/api/v1/rooms -H 'content-type: application/json' \
  -d '{"nickname":"Host"}'

# join (use the code from above)
curl -sX POST localhost:8090/api/v1/rooms/ABKM27/players -H 'content-type: application/json' \
  -d '{"nickname":"Tobi"}'

# lobby
curl -s localhost:8090/api/v1/rooms/ABKM27
```

---

## Manual test — WebSocket (the real-time path)

Use a Socket.IO client against `http://localhost:8090`. Protocol event names:

- Client → server: `client.join`, `client.action`
- Server → client: `server.joined`, `server.view`, `server.error`

**Join flow:**
1. `client.join` `{ roomCode, role: "display" }` → display joins; receives `server.view` broadcasts.
2. `client.join` `{ roomCode, role: "host" }` → host binds to its seat.
3. `client.join` `{ roomCode, role: "player", reconnectToken: "<token from join HTTP>" }` →
   player re-enters its seat (this is also the refresh/reconnect path, PRD §10).

**Action flow** (after the host starts a game):
- `client.action` `{ action: { type: "test_sim.answer", questionId, value } }` (simultaneous game)
- `client.action` `{ action: { type: "test_rr.submit", text } }` (round-robin game)

### Full playable loop (end-to-end, the thing to verify)

1. `POST /rooms {nickname:"Host"}` → note `code`, `hostId`.
2. `POST /rooms/:code/players {nickname:"Tobi"}` (and a second player for the round-robin game).
3. Open a Socket.IO client; `client.join` as `display` (and as each `player` with their token).
4. `POST /rooms/:code/start` with:
   ```json
   { "hostId": "<hostId>", "gameId": "test_simultaneous",
     "config": { "rounds": 1, "secondsPerQuestion": 20 },
     "content": { "questions": [{ "id": "q1", "prompt": "pick a number near 50", "target": 50 }] } }
   ```
   → display + players immediately receive `server.view` (the question; the **target is hidden**
   from players until reveal — verify it's absent in the player payload).
5. A player sends `client.action {action:{type:"test_sim.answer",questionId:"q1",value:48}}`.
6. When `secondsPerQuestion` elapses, the runtime auto-reveals (timer-driven), scores, and the
   game ends → room returns to `lobby`.

For the round-robin game (`test_round_robin`, ≥2 players, `content:{prompt:"..."}`): only the
current holder's `client.action {type:"test_rr.submit",text:"..."}` is accepted; others are
ignored; a turn times out after `turnSeconds`; validation runs (stub → always ok) and the verdict
re-enters to score by hold-time.

> These two games are throwaway contract-provers, not real games — but they exercise **every**
> engine path QA needs to see: simultaneous + turn-based, runtime timers, answer secrecy,
> scoring, async validation re-entry, and room lifecycle back to lobby.

---

## Edge Cases to Verify

| Scenario | Expected |
|----------|----------|
| Join unknown room | 404 `room_not_found` |
| Join with a taken nickname | 409 `nickname_taken` + `field_errors.nickname` |
| Create/join with empty nickname | 422 `validation_error` + `field_errors.nickname` |
| Unknown HTTP route | 404 `not_found` (in the error envelope) |
| `client.action` faster than ~5/sec sustained per player | `server.error` `{ code: "rate_limited" }` (token bucket, PRD §14) |
| Player reconnect with a valid `reconnectToken` | re-binds to the same seat, `connected = true` |
| Room idle > 30 min | room swept (idle GC) |
| Redis down at boot | server still boots; warning logged; snapshots best-effort |
| Start a game as a non-host (`hostId` mismatch) | 403 `not_host` |
| Start an unknown `gameId` | 404 `game_not_found` |
| Start with fewer than the game's min players | 409 `not_enough_players` |
| Start while a game is already running | 409 `game_already_running` |
| Player answers after the question deadline / out of turn | ignored (no score, no error) |
| **Restart server mid-game (Redis up)** | room + in-flight game recovered on boot; timers re-armed from absolute deadlines; missed deadlines fire immediately; clients re-broadcast on reconnect (PRD §12) |
| Restart server mid-game (Redis down) | room/game not recovered (best-effort) — expected without Redis |

---

## State Machine (room)

| State | Allowed transitions | Trigger |
|-------|---------------------|---------|
| `lobby` | → `in_game`, `closed` | host starts a game / host ends room |
| `in_game` | → `lobby` | game ends (returns to lobby) |
| `closed` | — | terminal |

Game-instance phases live inside each plugin (e.g. the test games' `question/reveal/done`,
`turn/await_validation/done`) — see the plugin source.

---

## Pagination

Not exercised in this slice (no list endpoints yet). The cursor codec exists
(`@shared/cursor`) and is cursor-based only when lists arrive.

---

## Known gaps / out of scope for this slice

> ⚠️ **These are deliberately NOT done — do not file as bugs.**

- [x] ~~No "start game" endpoint~~ — **DONE.** `POST /rooms/:code/start` creates the session via the
      `SessionManager`, so QA can play a full game over the socket end-to-end.
- [x] ~~Server-restart recovery gap~~ — **DONE.** Rooms + in-flight games are written through to Redis
      and rebuilt on boot by `SessionManager.recoverAll()` (snapshots are self-sufficient — they
      carry seed + players + state). Closes the PRD §12 hole.
- [ ] **Validation & AI are stubs.** `REQUEST_VALIDATION` always returns ok; `REQUEST_AI` is a
      no-op unless `OPENAI_API_KEY` is set. Concrete payloads/logic are a later block.
- [ ] **No persistence of game plays** to Mongo yet (`PERSIST_EVENT` currently logs only).
- [ ] **No admin, no host accounts, no real catalogue games.**
- [ ] **Observability** logs to stdout (no admin viewer, no metrics backend yet).
- [ ] **League mode** has a working session class but no HTTP/WS configurator.
- [ ] Tests are minimal smoke tests by request — not full coverage.

---

## Notes / deviations from the design doc (intentional, flagged)

- **`init` returns `StepResult<State>`** (state + initial effects), not bare `State` — reconciles the
  doc's §2 signature with its §8 "init emits startTimer + broadcast" example. Design doc updated.
- **Layering:** game-session lifecycle lives in a dedicated **`SessionManager`** (engine layer,
  imports no socket transport). The **gateway is pure transport** — it injects its `OutputSink`
  into the SessionManager and looks sessions up there. The **rooms service depends on the
  SessionManager**, not the gateway, so business logic never touches the socket layer. This is the
  consistent registry pattern (sibling to `roomRegistry`).
- Repo conventions followed over persona doctrine where they differ: **CommonJS + Node resolution**
  (no `.js` import extensions), **Jest** (not Vitest), **Mongo** (not Postgres) — all per the
  scaffold and PRD, as agreed.
