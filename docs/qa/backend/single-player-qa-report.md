# Backend QA Report — Single-Player Mode

**Author:** Backend QA
**Date:** 2026-06-07
**Against:** [`single-player-test-plan.md`](./single-player-test-plan.md) ·
[`single-player-handoff.md`](./single-player-handoff.md) · [`single-player-spec.md`](../../backend/single-player-spec.md) · engine [`game-engine.md`](../../backend/game-engine.md) · PRD
**Mode:** report-only (no source changed). Scratch probe + QA data removed after the run; repo suite confirmed **28/28, 10 suites** afterward.

---

## 0. Environment (as run)

- Real **Mongo** (`gbedity`, fully seeded — `words` ~1.24M / all 14 cats; quiz/hot-take/plead/rubric
  content seeded) + real **Redis**; placeholder OpenAI (hermetic) for Plead.
- Live `curl` (HTTP), real `socket.io-client@4` (WS, isolated `/tmp`), deterministic Jest probes
  (solo service + plugin state), `mongosh`/`redis-cli` for ground truth.
- Baseline before testing: `nx test backend` → **28/28, 10 suites**.

---

## 1. Verdict

The solo slice is **mostly solid**: all 6 peer-games are refused (409), all 12 solo-able games start
and run, validation is clean (404/422), the ephemeral room tears down on end, persistence records a
1-player play, **answer secrecy holds in the player projection**, and — critically — **solo's
collapsed-transport rule does NOT leak host/display to multiplayer non-hosts** (the engine + MP path
are untouched).

But there are **3 real bugs**, one of which lets solo Millionaire enable the exact lifelines the spec
says are impossible solo, and one that makes some solo games **show no prompt on (re)connect** —
matching the kind of "feels stuck" experience reported elsewhere.

| Sev | Count | IDs |
|-----|-------|-----|
| **P1** | 2 | SP-1 (default-config Millionaire keeps `ask_audience`/`phone_friend` solo), SP-2 (solo display projection not resent on join/reconnect → no prompt for Spelling Fast / one-shot-prompt games) |
| **P2** | 2 | SP-3 (ended solo rooms leak Redis snapshots — never deleted), SP-4 (doc drift: Word Bomb, `mode` field, refused count) |

No privilege leak, no secrecy leak, no engine regression. PASS inventory in §3.

---

## 2. Confirmed defects

### SP-1 — Default-config solo Millionaire keeps `ask_audience` + `phone_friend` — **P1**

**Where:** `features/solo/solo.service.ts:35-44` (`stripDisabled`) run **before** Zod defaults apply (`:67-68`).
**What:** `stripDisabled` removes `disabledConfig` keys from the **raw** config, then
`configSchema.safeParse` applies defaults. Millionaire's `lifelines` defaults to
`[fifty_fifty, ask_audience, phone_friend]`. When the client sends **no `lifelines`** (the common
case), there's nothing in the raw config to strip — and the default array (with the two solo-illegal
lifelines) is filled in afterward and **never re-stripped**.

**Repro (deterministic, plugin state after `soloService.start`):**
```
explicit [fifty_fifty, ask_audience, phone_friend] → stored ['fifty_fifty']                    ✓ stripped
explicit [ask_audience, phone_friend]              → stored []                                   ✓ stripped
DEFAULT config (no lifelines key)                  → stored ['fifty_fifty','ask_audience','phone_friend']   ✗ NOT stripped
```
Live confirm: default-config solo Millionaire's player view exposes `canVoteAudience` / `youArePhoned`
keys; the engine state has all three lifelines, so the plugin would accept an `ask_audience` action.

**Impact:** directly violates spec §1 ("Solo Millionaire ships with 50/50 only … the config can't
enable them") and the handoff's own smoke step 7. A solo player gets Ask-the-Audience / Phone-a-Friend
with **nobody to poll/call** → dead/confusing lifelines. It's the *default* path, so it's the path
most users hit.

**Likely fix:** strip `disabledConfig` **after** validation/defaults (run `safeParse` first, then prune
the disabled keys from the parsed config), or apply the strip to the parsed result as well as the raw
input.

---

### SP-2 — Solo display projection not resent on join/reconnect → no prompt for one-shot-prompt games — **P1**

**Where:** `engine/game-runtime.ts:365-368` (`resendTo` → `sendToPlayer` only); gateway solo join
`gateway/index.ts:189-197`.
**What:** A solo client joins all three channels (player+display+host, correctly gated on
player==host). But on join/reconnect the runtime calls `resendTo(seat.id)`, which **re-sends only the
PLAYER projection** — never the display or host projection. The solo device therefore only gets the
display content (the question/word/topic) on the **next broadcast** (a phase tick). For timer-driven
games that re-broadcast all audiences each tick, it self-heals within a couple seconds (Quizzes did).
But for games that emit the prompt **once at round start** — notably **Spelling Fast** (the word for
TTS), and effectively Wordshot's letter/category on a slow connect — the solo device gets **nothing to
show/speak until the next round** (or never, on a 1-round game).

**Repro (live, Spelling Fast solo, 30s word):**
```
[INITIAL JOIN]  audiences in first 600ms: ["player"]     → got the display view (word)? false
[RECONNECT]     audiences within 800ms:   ["player"]     → got the display view (word)? false
```
Contrast: over a *multi-round* Quizzes window the solo socket did receive `["player","host","display"]`
— because each new round re-broadcasts. So the collapse "works" only incidentally, for games that
re-broadcast; it's broken for the one-shot-prompt case, which includes the handoff's own TTS edge case
(SOLO-SPELLING).

**Impact:** solo Spelling Fast (and any one-shot-prompt solo game) shows **no prompt** on start/refresh
— the device sits with an input and no word. This is exactly the "feels stuck / nothing happening"
class of bug. It also means solo **reconnect/refresh** is broken for the display content.

**Likely fix:** `resendTo` for a seat that is also host (solo) should re-project **player + display +
host**, not just player — or the gateway should trigger a full re-broadcast (or `viewFor(display/host)`
sends) to a solo socket right after it joins those channels.

---

### SP-3 — Ended solo rooms leak Redis snapshots (never deleted) — **P2**

**Where:** `features/solo/solo.service.ts:104-108` `onEnded` → `sessions.end` + `registry.close`.
**What:** On solo completion the room is closed and the session ended, and `GET /solo/:id` correctly
404s — but the **Redis snapshot key is never deleted**. After this run: **17 `gbedity:snapshot:*`
keys vs fewer `gbedity:room:*`**; a sampled ended solo room (`56MAES`, HTTP 404, room key gone) still
had `gbedity:snapshot:56MAES` present.

**Impact:** unbounded snapshot accumulation in Redis (one per solo game, forever). Worse, on a server
restart `recoverAll()` would load these orphan snapshots and attempt to **recover already-ended ghost
solo games**. Not play-blocking, but a real leak + a recovery-correctness smell.

**Likely fix:** `onEnded` (and the general session-end path) should delete the Redis snapshot
(`deleteSnapshot(code)`) when a room is torn down. (Multiplayer rooms return to lobby so they re-use
the snapshot; solo rooms are ephemeral and should clean it up.)

---

### SP-4 — Doc drift (spec vs handoff vs code) — **P2**

Three doc mismatches; code is the source of truth, docs should be corrected:
- **Word Bomb:** spec §1/§3/§8 says keep it solo (degraded, min 1); **code refuses it** (no solo
  declaration → 409) and the handoff agrees. → fix the **spec**.
- **Persistence `mode`:** spec §3/§5 says persist `mode:'solo'`; **code has no `mode` field** (solo
  identified by `players.length === 1`), matching the handoff. Verified: solo `game_plays` keys are
  `{_id,id,roomCode,gameId,players,finalBoard,startedAt,endedAt,createdAt}` — no `mode`. → fix the **spec**.
- **Refused count:** handoff says "5 refused" but there are **6** (Investigation also has no solo
  declaration and 409s). → fix the **handoff** number.

---

## 3. PASS — verified clean (no defects)

| Area | Cases | Result |
|------|-------|--------|
| **Solo games list** | SOLO-LIST | `GET /solo/games` → exactly **12** games, correct set, shape `{gameId,title,category,mode}`; all 6 refused excluded. |
| **Refuse peer games** | SOLO-REFUSE | word_bomb, hot_take_court, catch_the_lie, truth_or_dare, presentation, **investigation** → all **409 `solo_not_supported`**. |
| **Start + validation** | SOLO-START-* | happy 201 (full fields); unknown→404 `game_not_found`; missing gameId→422 `field_errors.gameId`; bad config→422 `field_errors.config.rounds`; no/empty nickname→201 default **"You"**. |
| **State / reconnect** | SOLO-STATE | running → `{phase:in_game,over:false}`; unknown→404; route order (`/games` before `/:soloId`) correct. |
| **Millionaire (explicit)** | SOLO-MILL-1/2 | explicit audience/phone lifelines **stripped** (only the *default* path leaks — SP-1). |
| **Collapsed transport** | SOLO-WS | over a multi-round game the one solo socket receives **player + host + display** audiences (works for re-broadcasting games; SP-2 is the one-shot-prompt gap). |
| **Answer secrecy** | SOLO-SECRECY | the **player** projection has **no** `answerIdx`/`correctIdx` pre-reveal even in the collapsed transport — the secrecy rule the MP path relies on is intact. |
| **Lifecycle teardown** | SOLO-LIFECYCLE | on end, `GET /solo/:id`→404; room key removed; ephemeral room gone (snapshot leak is SP-3). |
| **Persistence** | PERSIST | solo `game_play` recorded, `players.length===1`, nickname "You", `finalBoard:[{playerId,points}]` when answered. |
| **REGRESSION — no privilege leak** | REG-HOSTGATE | a **multiplayer non-host** player receives **only** `player` audience — never host/display. Solo's channel-join is gated on `seat.id===room.hostId`; BUG-A host-gating holds. |
| **REGRESSION — manifest additive** | REG-MANIFEST | all 6 refused declare no solo; the 12 supported declare `supported:true`; every plugin still loads. |
| **REGRESSION — suite** | REG-SUITE | full backend suite **28/28, 10 suites** green before + after. |

---

## 4. Recommended fix order

1. **SP-1** (default Millionaire lifelines) — strip `disabledConfig` **after** Zod defaults; it's the
   default path and violates a stated solo guarantee.
2. **SP-2** (solo display resend) — `resendTo` for a solo (host==player) seat must re-project
   display+host, not just player; fixes no-prompt-on-connect for Spelling Fast / one-shot games +
   solo refresh.
3. **SP-3** (snapshot leak) — delete the Redis snapshot on ephemeral teardown.
4. **SP-4** (docs) — reconcile spec/handoff with code (Word Bomb refused, no `mode` field, 6 refused).

**Re-test on fix:** I have a deterministic repro for SP-1 (plugin state), a live repro for SP-2
(Spelling Fast join/reconnect), a Redis-count repro for SP-3, and the full suite (refusal, validation,
collapsed transport, secrecy, persistence, MP no-leak regression) ready to re-run.

## 5. Known limits (per handoff — NOT bugs)
No high-score/personal-best; no solo-league; the refused games aren't solo-playable; Word Bomb
excluded from solo. Each documented seam otherwise behaved as the handoff described.
