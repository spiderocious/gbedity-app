# Gbedity — Single-Player Mode Spec

**Status:** BUILT · this doc is the original design; the §8 open questions were answered and the
**decisions below override** any earlier text (it's kept for design history). See the QA handoff
[`single-player-handoff.md`](../qa/backend/single-player-handoff.md) for the as-built behaviour.
**Goal:** a user can pick a game, set config, hit start, **play alone**, and see their own score —
no room of other people, no waiting on others.
**Source of truth:** the PRD + the built engine ([`game-engine.md`](./game-engine.md)). This adds a
*play mode*, not a new engine.

> **Decisions applied (override earlier text in this doc):**
> - **Refused solo (5):** Word Bomb + the 4 peer-vote/rate games (Hot Take Court, Catch the Lie,
>   Truth or Dare, Presentation). Word Bomb was **excluded** (its pass-the-bomb tension is the point)
>   — ignore the "keep Word Bomb / minPlayers:1" passages below.
> - **Solo-supported (13):** the 12 single-player-scored games **+ Investigation** (per-player
>   accusation, scored vs the revealed truth — no peer dependency). Millionaire strips its
>   ask-audience / phone-a-friend lifelines in solo.
> - **No `mode:'solo'` field** was added (it would touch the shared multiplayer persistence path);
>   solo plays are identifiable as single-player records. Ignore the `mode:'solo'` passages below.
> - **No personal-best / high-score store** and **no solo-league** — end-of-game total only.

> The PRD's v1 is multiplayer-first (phones-as-controllers, a shared display). Single-player is an
> additive mode: the same plugins, the same runtime, but **one human** and a **collapsed transport**
> (the player's own device is player + display + host at once). No plugin rewrites — the constraint
> is which games are *meaningful* with one player.

---

## 1. The core question: which games work solo?

Single-player means **one human, no other players to act / vote / rate / take turns against.** A
game works solo iff its **scoring and progression depend only on the single player + the clock +
fixed content** — never on other humans.

### ✅ Works as-is (12 games)
Per-player, absolute scoring against the clock/content. Solo is just "a room of 1":
**Quizzes, Bible Quiz, Wordshot, Scrambled Word, Missing Letters, Spelling Fast, Definition Race,
Synonyms, Antonyms, Typing Fast** — each scores *your* correctness/speed; other players never
affected your score anyway. Also **Plead Your Case** (AI scores *your* argument absolutely; the
comparative rank is just "you vs you" → you rank 1st, absolute score is the real feedback).

### ⚠️ Degraded but playable solo (2 games)
- **Word Bomb** — round-robin, but with one player the "bomb" simply stays on you each turn: it
  becomes a **solo survival/score run** (keep naming category words before the timer, hold-time
  scoring, no-repeat). Min players drops to 1 in solo. Works, but loses the social "pass the bomb"
  tension.
- **Millionaire** — rotational ladder works solo (it's *your* ladder). BUT two lifelines need other
  humans: **Ask-the-Audience** (nobody to poll) and **Phone-a-Friend** (nobody to call). Solo
  Millionaire ships with **50/50 only**; the other two are disabled in solo (and the config can't
  enable them).

### ❌ Cannot work solo (4 games) — and *why*
Their entire scoring/mechanic IS other humans:
- **Hot Take Court** — you write a defence; *others vote*. Solo = no voters = no score. The game is
  the voting.
- **Catch the Lie** — others guess *your* lie and you guess *theirs*. Solo = nobody to fool, nobody
  to catch. Dead.
- **Truth or Dare** — *others vote* whether you completed the dare. Solo = no judges.
- **Presentation** — *others rate* your presentation across criteria. Solo = no audience.

**Rule of thumb:** anything in mode `SUBMIT_VOTE`, or `ROUND_ROBIN`/`SUBMIT_REVEAL` whose points
come from *peer votes/ratings*, is multiplayer-only. The voting/rating games (the 4 above) are
**explicitly excluded** from single-player; the engine/HTTP will refuse to start them solo.

> *(Future option, out of scope here: AI could stand in as the "audience"/"voter" for those 4 — but
> that's a different feature with real fairness/quality questions. Not in this spec.)*

---

## 2. How a plugin declares solo support

Add one field to the manifest (`game-engine.md §2.1`) — no plugin logic changes for the 12 that
already work:

```ts
manifest.solo?: {
  supported: boolean;            // false → cannot be started solo (the 4 voting games)
  minPlayers?: number;           // overrides players.min in solo (e.g. Word Bomb 3 → 1)
  disabledConfig?: string[];     // config keys forced off in solo (e.g. Millionaire ask_audience/phone_friend)
}
```

- 12 games: `solo: { supported: true }`.
- Word Bomb: `solo: { supported: true, minPlayers: 1 }`.
- Millionaire: `solo: { supported: true, disabledConfig: ['ask_audience','phone_friend'] }`
  (enforced: solo strips those from `lifelines`).
- Hot Take / Catch the Lie / Truth or Dare / Presentation: `solo: { supported: false }`.

This keeps "what's solo-able" **declared on the game**, not hardcoded in the room layer — consistent
with how capabilities + player limits already live on the manifest.

---

## 3. Architecture — reuse, don't rebuild

The engine already supports a 1-player room (the runtime iterates `players`, scores per-player,
fans out via `view(audience)`). Single-player is **a thin wrapper that creates a 1-player session
and collapses the three audiences onto one socket.**

```
POST /solo/start  ──► SoloService
   - validate game supports solo (manifest.solo.supported)
   - validate config (plugin schema) + strip disabledConfig keys
   - resolve content server-side (existing resolver, rating-filtered)
   - create an ephemeral 1-player "room" (auto-host = the player)
   - SessionManager.create(...) — SAME SingleSession/GameRuntime as multiplayer
   ──► returns { soloId, playerId, reconnectToken }
WS: the one client joins as role=player; the runtime's host/display/player views all route to it
```

Key reuse points:
- **Same `GameRuntime`, `SingleSession`, content resolvers, validation/AI services, persistence.**
- **`view(audience)`** already projects per-audience; in solo the client subscribes to *all three*
  channels (host+display+player) so it sees the question (display), its own input (player), and can
  advance (host) — or we just send it the player+display projections merged. The answer-secrecy
  rules still hold (e.g. Spelling Fast: the word goes to the display projection the solo client
  renders+speaks, never the "player" projection — still correct, since it's one trusted device).
- **Persistence:** solo plays are recorded the same way (`game_plays` with a single player), so they
  show in admin history + metrics, tagged `mode: 'solo'`.
- **No league in solo** (league is inherently multi-game-multi-player session orchestration; out of
  scope — solo is one game, one player).

### Auto-advance in solo
Multiplayer relies on the host clicking "next" / timers. Solo has no separate host, so:
- **Timer-driven games** (all the simultaneous ones) already auto-advance on `onTick` — no change.
- The solo client *is* the host, so host-gated actions (if any) are allowed from the solo player.
- Round → reveal → next flows entirely on the existing runtime timers. Solo just doesn't wait on
  other submissions (there are none).

---

## 4. HTTP / WS surface (new)

Minimal, parallels the room edge:

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/solo/start` | `{ nickname, gameId, config? }` | **201** `{ soloId, playerId, reconnectToken, wsRole }` · **404** `game_not_found` · **409** `solo_not_supported` (a voting game) · **422** validation |
| GET | `/solo/:soloId` | — | **200** current state snapshot (for reconnect/poll) |

WS: same `client.join` (role `player`) + `client.action` (the game's action shapes) + `server.view`.
A solo client may subscribe to display+player projections. `server.room_ended` on completion.

`GET /games` (optional helper): list games with a `soloSupported` flag so the UI can show/grey-out
the right ones.

---

## 5. Scoring & "done"

- Solo score = the player's own `RoundScore` deltas accumulated over the game (the existing
  leaderboard, with one row). No normalization needed.
- On `GAME_ENDED`: the solo client gets a final view with the player's total + per-round breakdown.
  Persisted to `game_plays` (`mode: 'solo'`) → visible in admin history/metrics.
- **Personal best (optional, small):** since solo scores are comparable run-to-run, we *could* store
  a per-game high score keyed by nickname (or host account if logged in). Flagging as an optional
  add — see open questions.

---

## 6. What does NOT change
- The engine contract, plugins, validation, AI, content service, recovery, admin, league — all
  untouched. Solo is purely additive: a manifest flag + a thin `SoloService`/route + a tiny
  client-transport collapse.
- The 12 already-solo-able games need **zero plugin changes**.

---

## 7. Build outline (small)
1. `manifest.solo` field on the contract + set it on all 18 plugins (12 supported, 2 degraded, 4 not).
2. Millionaire: in solo, strip `ask_audience`/`phone_friend` from `lifelines`; Word Bomb: solo min 1.
3. `SoloService` + `POST /solo/start` + `GET /solo/:id` (reuses SessionManager/SingleSession).
4. Gateway: allow a solo player to receive display+player projections on one socket.
5. Persist solo plays (`mode:'solo'`); `GET /games` exposes `soloSupported`.
6. Tests: a solo Quizzes run end-to-end; a `solo_not_supported` rejection for Hot Take.

---

## 8. Open questions
1. **The 4 voting games solo** — confirm we **exclude** them (refuse to start), rather than attempt
   an AI-stand-in audience now? (Recommend exclude; AI-audience is a separate feature.)
2. **Word Bomb solo** — keep it (as a solo survival run, min 1)? Or exclude it too since the
   pass-the-bomb social tension is the point? (Recommend keep — it's a fun solo time-attack.)
3. **Personal best / high scores** — build the small per-game high-score store now, or just show the
   end-of-game total and defer leaderboards? (Recommend defer; show the total now.)
4. **Solo without a nickname** — require a nickname, or allow a default "You"? (Recommend allow
   default; no account needed.)
5. **Multi-game solo session** ("play 3 in a row, combined score") — out of scope for v1 solo, or
   wanted? (Recommend out of scope — that's basically solo-league, a later add.)
