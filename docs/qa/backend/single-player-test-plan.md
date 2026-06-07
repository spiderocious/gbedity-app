# Backend QA Test Plan — Single-Player Mode

**Author:** Backend QA
**Date:** 2026-06-07
**Tests against:** [`single-player-handoff.md`](./single-player-handoff.md) ·
[`single-player-spec.md`](../../backend/single-player-spec.md) · engine [`game-engine.md`](../../backend/game-engine.md) · PRD
**Builds on:** the previously QA-passed engine + full-catalogue slices — see
[`game-engine-qa-report.md`](./game-engine-qa-report.md), [`full-backend-qa-report.md`](./full-backend-qa-report.md).
**Scope:** **backend only** (HTTP + WS + persistence + engine reuse). No frontend.
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`.

> Single-player = **one human, no other players**. An ephemeral 1-player room where the player IS the
> host; the one device receives player + display + host projections on a single socket. Reuses the
> **same** SessionManager / SingleSession / GameRuntime as multiplayer — solo is a thin start path,
> not a new engine. The whole QA question is: **does the thin path stay correct, and does it leave
> the shared multiplayer path untouched?**

---

## 0. Method & guardrails

- **Mode 1 (source audit, §1):** read before executing; each row is a hypothesis + the case that
  confirms/refutes it. Done — findings below.
- **Mode 2 (execution, §2–§7):** exact assertions only — exact status, exact `error.code`, exact
  response/`view` shape, plus ground truth (Mongo via `mongosh`, runtime via deterministic Jest, WS
  via `socket.io-client`).
- Real Mongo + Redis (never mocked); placeholder OpenAI (hermetic) for Plead; scratch probes + any
  QA data removed after; repo suite confirmed green afterward. Report-only — no source changed.
- **Regression is first-class (§6):** solo claims to reuse the multiplayer engine and *not* touch the
  shared path. I verify the multiplayer path still passes.

---

## 1. Mode-1 source-audit findings (confirm before execution)

Read `solo.service.ts`, `solo.controller/routes`, the gateway solo rule, `engine/types.ts`
(`manifest.solo`), the per-plugin declarations, error/message keys, and `registry`. Implementation is
clean (ServiceResult at the edge, `safeParse` → 422 with field_errors, `/games` before `/:soloId`,
new keys present, gateway solo channel-join behind a host==player guard). Findings → cases in §2–§6.

| ID | Location | Finding / hypothesis | Sev (pre) | Confirms via |
|----|----------|----------------------|:---------:|--------------|
| SA-1 | **handoff vs spec — Word Bomb** | Spec §1/§8 says keep Word Bomb solo (min 1, degraded); the **handoff refuses it** (no `solo` declaration → 409). Code has **no solo decl** on word-bomb → refused. **Handoff wins (newer)**; flag the spec/handoff drift. | P3 (drift) | SOLO-REFUSE |
| SA-2 | **handoff vs spec — persistence `mode`** | Spec §3/§5 says persist solo as `mode:'solo'`; **handoff says no `mode` field was added** (solo = `players.length===1`). Confirm the actual `game_plays` record shape — is there a `mode` field or not? Either is fine, but docs must match reality. | P2 (drift) | PERSIST-1 |
| SA-3 | `solo.service.ts:62` eligibility | A game with **no `solo` block** (or `supported!==true`) → **409 `solo_not_supported`**. Confirm for all 6 refused (word_bomb, hot_take_court, catch_the_lie, truth_or_dare, presentation, investigation). | P1 | SOLO-REFUSE |
| SA-4 | `solo.service.ts:67` strip-then-validate | `stripDisabled` removes `disabledConfig` keys **and** prunes them from any array field, THEN `safeParse`. Confirm Millionaire `lifelines:[fifty_fifty, ask_audience, phone_friend]` → stored lifelines = **[fifty_fifty]** only (audience/phone stripped), and a config that *only* requests stripped lifelines still starts. | P1 | SOLO-MILL |
| SA-5 | `solo.service.ts:85` content resolve | `resolver ? resolve(...) : {}` then `contentSchema.safeParse`. For a solo game whose resolver returns empty/insufficient content (e.g. unseeded deck), it should **422 `validation_error`** (content), not 500, and **close the room** (`registry.close`) so no orphan. | P1 | SOLO-CONTENT |
| SA-6 | gateway `:186-191` solo channel-join | The solo socket joins **player + display + host** channels only when player==host. Confirm a solo client receives **display-audience** projections (e.g. the question/word) AND can drive **host-gated** actions — on one socket. And that a *multiplayer* player (not host) is **not** joined to host/display (no privilege leak). | P1 | SOLO-WS, REG-HOSTGATE |
| SA-7 | answer-secrecy in collapsed transport | Solo collapses 3 audiences onto 1 device. Spelling Fast / Quizzes hide the answer in the **player** projection but reveal it in **display** (which the solo device also gets). Confirm this is *intended* (one trusted device) and that the **player** projection itself still doesn't leak the answer pre-reveal (so the rule isn't quietly broken for multiplayer too). | P1 | SOLO-SECRECY |
| SA-8 | `solo.service.ts:104` teardown | `onEnded` → `sessions.end` + `registry.close`. After a solo game ends, `GET /solo/:id` → **404 `solo_not_found`** (ephemeral), the Redis snapshot is gone, and no orphan room/runtime remains. | P1 | SOLO-LIFECYCLE |
| SA-9 | `/solo/start` validation | `nickname?` optional → default "You"; unknown game → 404; bad config → 422 + field_errors; missing `gameId` → 422. | P1 | SOLO-START-* |
| SA-10 | `GET /solo/games` | Returns **only** `solo.supported===true` games; shape `{gameId,title,category,mode}`; excludes the 6 refused. Count should be **12** (10 standalone + synonyms + antonyms from the relation factory; Millionaire included). | P2 | SOLO-LIST |
| SA-11 | `solo.service.ts:131` state-after-end race | `state()` returns `over:true` if `runtime` is gone — but `onEnded` closes the room, so a just-ended game is 404 (room gone) before `over:true` is reachable. Confirm the ordering: is there a window where `over:true` returns vs 404? Document the actual sequence. | P3 | SOLO-STATE |
| SA-12 | no-auth surface | `/solo/*` is unauthenticated (by design). Confirm none of it requires/accepts a token, and it can't be used to reach admin/host-only behaviour. | P2 | SOLO-NOAUTH |

---

## 2. `/solo/games` + `/solo/start` + `/solo/:id` (HTTP edge)

| # | Test | Method | Expected |
|---|------|--------|----------|
| SOLO-LIST | List solo games | `GET /solo/games` | **200** `{games:[{gameId,title,category,mode}]}`; includes Quizzes, Wordshot, Bible Quiz, Spelling Fast, Typing Fast, Scrambled Word, Missing Letters, Definition Race, Synonyms, Antonyms, Plead Your Case, **Millionaire**; **excludes** Hot Take, Word Bomb, Catch the Lie, Truth or Dare, Presentation, Investigation. Count = **12**. |
| SOLO-START-1 | Start happy (Quizzes) | `POST /solo/start {gameId:"quizzes",config:{rounds:3,category:"nigerian"}}` | **201** `{soloId,gameId,instanceId,playerId,reconnectToken,wsRole:"player"}`; `soloId`/`playerId` prefixed; room is `in_game`. |
| SOLO-START-NONICK | No nickname → default "You" | `POST /solo/start {gameId:"quizzes"}` (+ resolvable config) | **201**; the player's nickname is **"You"** (verify in the WS view / persistence). |
| SOLO-START-EMPTYNICK | Empty/whitespace nickname | `{nickname:"   ",gameId:"quizzes"}` | **201**; nickname falls back to **"You"** (`.trim()||DEFAULT`). |
| SOLO-START-UNKNOWN | Unknown game | `{gameId:"nope"}` | **404** `game_not_found`. |
| SOLO-REFUSE | Each peer-vote/peer-rate game | `{gameId:"hot_take_court"}` (+ word_bomb, catch_the_lie, truth_or_dare, presentation, investigation) | **409 `solo_not_supported`** for **all six**. |
| SOLO-START-BADCFG | Bad config | `{gameId:"quizzes",config:{rounds:-1}}` (or wrong type) | **422 `validation_error`** + `field_errors.config.*` (path-prefixed). |
| SOLO-START-NOGAME | Missing gameId | `{config:{}}` | **422 `validation_error`** + `field_errors.gameId`. |
| SOLO-CONTENT | Resolver yields insufficient content | start a solo game whose deck/word set can't satisfy the schema (e.g. force an empty category) | **422 `validation_error`** (content), **not 500**; and the ephemeral room is **closed** (no orphan — verify via registry/Redis). |
| SOLO-STATE | Snapshot during play | `GET /solo/:soloId` while running | **200** `{soloId,gameId,phase,over:false}`. |
| SOLO-STATE-UNKNOWN | Unknown id | `GET /solo/ZZZZZZ` | **404 `solo_not_found`**. |
| SOLO-ROUTE-ORDER | `/games` not shadowed | `GET /solo/games` resolves the list, not the `:soloId` handler | **200** list (confirms route order). |

**Cross-check (mongosh):** after SOLO-CONTENT, the room code is absent from any active set; after a
normal start, exactly one `game_plays` record appears only at end (§5).

---

## 3. Millionaire solo (lifeline stripping)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| SOLO-MILL-1 | Strip audience/phone | `POST /solo/start {gameId:"millionaire",config:{lifelines:["fifty_fifty","ask_audience","phone_friend"]}}` | **201**; the running game's `lifelines` = **["fifty_fifty"]** only (verify via the WS view's `lifelines`/`lifelinesUsed`, or deterministic plugin-state check). |
| SOLO-MILL-2 | Only stripped lifelines requested | `config:{lifelines:["ask_audience"]}` | **201**; resulting lifelines = **[]** (all requested were stripped) — still starts, not a 422. |
| SOLO-MILL-3 | 50/50 still usable | in-game, use `fifty_fifty` | accepted (lifeline works solo). |
| SOLO-MILL-4 | Stripped lifeline unusable | in-game, attempt `ask_audience` action | ignored / not available (it's not in `lifelines`). |
| SOLO-MILL-5 | Default config | `{gameId:"millionaire"}` (default lifelines incl. all three) | **201**; stored lifelines = **[fifty_fifty]** (defaults also stripped in solo). |

---

## 4. WebSocket — collapsed transport (player == host == display)

Driven with a real `socket.io-client`, joining `{roomCode:<soloId>, role:"player", reconnectToken}`.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| SOLO-WS-1 | Join + play a full Quizzes solo | join → receive `server.view`; answer; let timer advance | `server.joined`; then `server.view` with the question; `quizzes.answer{questionIdx,choiceIdx}` is scored; round→reveal→next→end auto-advances on runtime timers (no second player needed). |
| SOLO-WS-DISPLAY | Solo socket gets the display projection | inspect views received by the one socket | the solo device receives the **display-audience** projection (question/word/category/etc.) AND the **player-audience** projection — both on the one socket (verify `audience` tags include `display` and `player`). |
| SOLO-WS-HOSTACT | Solo player can drive host-gated actions | a host-only action (if the game exposes one, e.g. Plead `plead.override`) from the solo socket | **accepted** (solo player == host; `ctx.role` is host). Cross-checks the BUG-A role gate from the host side. |
| SOLO-SECRECY | Answer secrecy intact | Quizzes: capture player-audience patches in QUESTION | the **player** projection has **no** `answerIdx`/`correctIdx` pre-reveal (the display projection may, by design — one trusted device). Confirms the collapse didn't break the player-projection secrecy that multiplayer also relies on. |
| SOLO-SPELLING | Spelling Fast solo TTS path | start Spelling Fast solo; inspect views | the **word** reaches the solo device via the **display** projection (for TTS render/speak); the **player** projection still doesn't carry the spelled word as a leak path. (Edge-case from the handoff.) |
| SOLO-WS-END | Room ends on completion | finish a solo game | `server.room_ended` (or the runtime end → teardown); `GET /solo/:id` → **404** afterward (SOLO-LIFECYCLE). |
| SOLO-WS-RECONNECT | Reconnect by token mid-game | disconnect, rejoin with `reconnectToken` | re-binds the seat; `server.resumed` + fresh `server.view` of current state (reuses the verified reconnect path). |

---

## 5. Persistence & metrics

| # | Test | Steps | Expected |
|---|------|-------|----------|
| PERSIST-1 *(SA-2)* | Solo play recorded | finish a solo Quizzes game; query Mongo | one `game_plays` record with **`players.length === 1`**, correct `{id,roomCode,gameId,finalBoard[{playerId,points}],startedAt,endedAt}`. **Confirm whether a `mode:'solo'` field exists** — reconcile with whichever doc is wrong (handoff says no field; spec says `mode:'solo'`). |
| PERSIST-2 | Appears in admin metrics | `GET /admin/metrics` (authed) after a solo run | the solo `gameId` shows in `byGame` (plays count includes the solo play). |
| PERSIST-3 | session_events size-not-contents | during solo play | `session_events` for the solo instance carry only ids/tags/sizes — **no** content/nickname leak (regression of the PRD §12 rule under the collapsed transport). |
| PERSIST-4 | No orphan after teardown | after end | no leftover snapshot in Redis for the soloId; registry has no room; `activeRuntime(soloId)` gone. |

---

## 6. REGRESSION — engine + multiplayer untouched

Solo claims to reuse the engine and not touch the shared path. Prove it.

| # | Regression | Expected |
|---|------------|----------|
| REG-SUITE | Repo suite | `nx test backend` green (≥ current count; solo added `solo.test.ts` 3/3). |
| REG-MULTI-START | Multiplayer start still works | `POST /rooms/:code/start` for a real game → 201, runs to lobby (the manifest gained `solo?` but multiplayer ignores it). |
| REG-HOSTGATE | No privilege leak to multiplayer players | in a **multiplayer** room, a non-host player is **not** joined to host/display channels and **cannot** drive host-only actions (re-confirm BUG-A from the multiplayer side — solo's channel-join rule must be gated on player==host only). |
| REG-ENGINE | Engine fixes intact | the prior §12 set (sim ends, recovery fires missed deadline, no half-applied transition, validation-timeout advances) still green (deterministic). |
| REG-MANIFEST | `manifest.solo` is additive | every existing plugin still loads; the contract change (`solo?` optional) didn't break any manifest. |
| REG-SECRECY-MP | Multiplayer secrecy intact | a multiplayer player still never receives `answerIdx`/authorship pre-reveal (solo's transport collapse didn't relax the shared `view(audience)`). |

---

## 7. Cross-cutting

| # | Check | Expected |
|---|-------|----------|
| X-1 | Envelopes | success `{data}`; error `{error:{code,message,field_errors?}}`. |
| X-2 | New error codes | `solo_not_supported`, `solo_not_found` present + used with correct HTTP status (409 / 404). |
| X-3 | No-auth surface (SA-12) | `/solo/*` needs no token and grants no admin/host privilege beyond the solo room. |
| X-4 | No secrets/PII | no `passwordHash`, no `reconnectToken` echoed except in the start body (intended), no answer pre-reveal in the player projection. |
| X-5 | IDs prefixed | `soloId`/room code, `playerId` (`pl_`), `instanceId` (`gi_`). |
| X-6 | Ephemeral cleanup | solo rooms never accumulate (teardown on end; no idle orphans). |

---

## 8. Execution order & exit criteria

**Order (highest-risk first):**
1. §1 source findings — confirm SA-3 (refusal of all 6), SA-5 (content→422 + room closed), SA-6
   (solo channel-join gated on player==host; no MP leak), SA-7 (secrecy), SA-8 (teardown).
2. §2 HTTP edge + §3 Millionaire stripping.
3. §4 WS collapsed transport (the core solo behavior) + §5 persistence.
4. §6 regression (engine + multiplayer untouched) — fast, mostly deterministic.
5. §7 cross-cutting sweep.

**Severity rubric:** **P0** breaks a guarantee (secrecy leak in the player projection, a refused game
starts, privilege leak to a multiplayer non-host) or the engine contract · **P1** functional gap vs
handoff (wrong refusal, lifeline not stripped, content 500 instead of 422, orphan room) · **P2**
wrong status/shape, doc-vs-code drift that matters · **P3** cosmetic / harmless drift.

**Exit criteria:**
- All 6 refused games → **409 `solo_not_supported`**; all 12 supported start and run solo end-to-end.
- Millionaire strips `ask_audience`/`phone_friend` (incl. defaults); 50/50 works solo.
- Solo content shortfall → **422** + room closed (no orphan); ephemeral teardown leaves nothing behind.
- **Answer secrecy in the player projection is intact** (collapse didn't relax it for anyone).
- **No privilege leak:** the solo channel-join is gated on player==host; multiplayer non-hosts are
  unaffected (BUG-A still holds).
- Solo plays persist (`players.length===1`) and show in metrics; doc-vs-code (`mode` field, Word Bomb)
  reconciled.
- **Full §6 regression green** — engine + multiplayer path unchanged.

**Known limits (per handoff — NOT bugs):** no high-score/personal-best; no solo-league; the 5 (per
handoff, 6 incl. Investigation) refused games aren't solo-playable; Word Bomb excluded from solo.

---

## 9. Doc-vs-code drift to settle (surfaced now, not bugs to fix in code)

1. **Word Bomb:** spec says keep it solo (min 1); handoff + code **refuse** it. → fix the **spec**.
2. **Persistence `mode`:** spec says `mode:'solo'`; handoff says no field (use `players.length===1`).
   → confirm code, fix whichever doc is wrong.
3. **Refused count:** handoff says "5 refused" but lists/implies **6** (Investigation also has no solo
   decl). → confirm the intended count and fix the handoff number.
4. **Spec §3 "Degraded but playable (2)":** Word Bomb + Millionaire — but Word Bomb is refused in
   code, so only Millionaire is degraded. → align the spec.
