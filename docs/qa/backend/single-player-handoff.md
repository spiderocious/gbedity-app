# Backend QA Handoff — Single-Player Mode

**Date:** 2026-06-07
**Build:** Typecheck ✅ · Lint ✅ · Tests ✅ (solo: 3/3; full suite green) · e2e smoke ✅
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`
**Spec:** [`docs/backend/single-player-spec.md`](../../backend/single-player-spec.md)
**Builds on:** the engine + the full game catalogue — contract unchanged except one additive
`manifest.solo` field.

> Single-player = **one human, no other players**. A user picks a game, sets config, starts, plays
> alone, sees their score. Reuses the **same** SessionManager / SingleSession / GameRuntime as
> multiplayer — solo is a thin start path, not a new engine.

---

## What can be played solo

A game is solo-able only when its scoring depends on the player + clock + content (never on other
humans). Declared per-game via `manifest.solo.supported`.

**✅ Solo-supported (12):** Quizzes, Bible Quiz, Wordshot, Scrambled Word, Missing Letters,
Spelling Fast, Definition Race, Synonyms, Antonyms, Typing Fast, Plead Your Case, **Millionaire**
(lifelines that need other players — Ask-the-Audience, Phone-a-Friend — are **stripped in solo**;
50/50 remains).

**❌ Refused solo (5):** Word Bomb, Hot Take Court, Catch the Lie, Truth or Dare, Presentation —
their score *is* other humans (pass-the-bomb / voting / rating). Starting these solo returns
**409 `solo_not_supported`**.

---

## Endpoints (new)

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/solo/games` | — | **200** `{ games: [{ gameId, title, category, mode }] }` — only solo-supported games |
| POST | `/solo/start` | `{ nickname?, gameId, config? }` | **201** `{ soloId, gameId, instanceId, playerId, reconnectToken, wsRole:"player" }` · **404** `game_not_found` · **409** `solo_not_supported` · **422** validation |
| GET | `/solo/:soloId` | — | **200** `{ soloId, gameId, phase, over }` (reconnect/poll) · **404** `solo_not_found` |

- **No auth, no account** — `nickname` is optional (defaults to **"You"**).
- `config` is the game's normal config (same schema as multiplayer start). For Millionaire, any
  `ask_audience` / `phone_friend` lifelines are silently stripped before validation.

### WebSocket
Same protocol as multiplayer. The solo client `client.join { roomCode: soloId, role: "player",
reconnectToken }`. Because the solo player **is** the room's host, the gateway also subscribes that
one socket to the **display** and **host** channels — so the single device receives the question /
word / topic / TTS projection (display) and can drive host-gated actions, all on one socket. The
answer-secrecy rules still hold (e.g. Spelling Fast sends the word to the display projection the
solo device renders+speaks, never to a separate "player" view).

---

## Smoke flow to verify

1. `GET /solo/games` → list includes Quizzes/Wordshot/…/Millionaire; excludes Hot Take/Word Bomb/etc.
2. `POST /solo/start { gameId:"quizzes", config:{ rounds:3, category:"general" } }` → 201 with
   `soloId` + `reconnectToken`.
3. WS `client.join { roomCode: <soloId>, role:"player", reconnectToken:<token> }` → `server.joined`,
   then `server.view` with the question (answer hidden until reveal).
4. `client.action { action:{ type:"quizzes.answer", questionIdx:0, choiceIdx:1 } }` → scored.
5. Timer advances round → reveal → next → end. On end, the solo room is torn down (it's ephemeral).
6. `POST /solo/start { gameId:"hot_take_court" }` → **409 `solo_not_supported`**.
7. `POST /solo/start { gameId:"millionaire", config:{ lifelines:["fifty_fifty","ask_audience"] } }`
   → 201; the ask_audience lifeline is stripped.

---

## Edge cases

| Scenario | Expected |
|---|---|
| Start a peer-vote game solo | 409 `solo_not_supported` |
| Start an unknown gameId solo | 404 `game_not_found` |
| Start with no nickname | succeeds; nickname = "You" |
| Bad config solo | 422 `validation_error` + field_errors |
| `GET /solo/:soloId` after game ends | 404 `solo_not_found` (ephemeral room torn down) |
| Solo Spelling Fast | the word reaches the solo device (display projection) for TTS; there is no separate hidden "player" leak path |

---

## Persistence / metrics

Solo games are recorded through the **same** `SingleSession` → `game_plays` persistence as
multiplayer, so they appear in admin history + metrics. A solo play is identifiable as a
**single-player** record (`players.length === 1`); no separate `mode` field was added (deliberately,
to avoid touching the shared multiplayer persistence path).

---

## Known limits (intentional — per product decisions)

- **No end-of-game high score / personal best** — the final view shows the player's total + per-round
  breakdown only. (Deferred.)
- **No solo-league** (play several games in a row for a combined score) — out of scope.
- **The 5 refused games** are not playable solo (no AI-stand-in audience — that's a separate
  feature).
- **Word Bomb is excluded** from solo (the pass-the-bomb social tension is the point).

---

## Layering note

Solo added: one `manifest.solo` field (engine contract), per-plugin flags, a `SoloService` +
`/solo` routes, and a small gateway rule (solo player == host ⇒ also join display+host channels).
The engine, the 12 solo-able plugins' logic, validation, content, persistence, and the multiplayer
path are **otherwise untouched**.
