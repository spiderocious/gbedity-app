# Frontend ↔ Backend Integration Plan

> How the mock UI ties to the real backend (`http://localhost:8090`). Plan-first; build
> follows on approval. Source of truth: `docs/backend/api-docs.md` + `game-engine.md`.

---

## 1. The shape of the integration (what the contract tells us)

Two transports, clean split:

1. **REST (`/api/v1`)** — *setup & lifecycle only*: create room, join lobby, lobby snapshot,
   start game, start league, league standings, host/admin auth, admin content. Envelope is
   `{ data }` / `{ error: { code, message, field_errors? } }`. **Switch on `error.code`, never message.**
2. **Socket.IO (same origin)** — *all live play*. The model is **server-authoritative view
   projection**:
   - Client sends `client.join { roomCode, role, reconnectToken?, playerId? }` then
     `client.action { action }`.
   - Server pushes `server.view { audience, patch }` — **the patch IS the view-model for that
     audience**. Answer-secrecy + content-rating are enforced server-side; a client physically
     cannot receive data the projection omits.
   - Lifecycle pushes: `server.joined`, `server.error { code }`, `server.room_suspended`,
     `server.room_ended`, `server.resumed`.

The big consequence for our UI: **the in-game screens stop owning state.** Today each game's
`renderDisplay/renderPlayer` draws from hard-coded mock; live, they render whatever `patch`
the server sends for their audience. The screen becomes a pure function of `(patch) → JSX`.

## 2. Confirmed against the live server (it's running on :8090)

- `GET /health` → `{ status:'ok', service, env, time }` ✓
- `POST /rooms {nickname}` → `{ data: { code, hostId, hostToken, display_url, join_url } }` ✓
- `GET /rooms/:code` → `{ data: { code, phase, players:[{id,nickname}] } }` ✓

**Drift caught:** backend `display_url`/`join_url` are `/display/:code` and `/join/:code`.
Our route constants use `/host/room/:code/display` and `/join`. We align the client routes to
what the backend hands out (or map them) — TBD in §6.

**Still to capture live:** the per-game `server.view` `patch` shapes. The docs define the
*model* (one patch per audience) but not each game's literal fields. We'll probe them by
connecting a socket, starting each game, and recording real payloads (§4) — not guessing.

## 3. Architecture — where the wiring lives (FSD, no logic in components)

```
apps/game/src/shared/
  config/env.ts            # VITE_API_BASE_URL, VITE_WS_URL (centralised; fail-loud)
  services/
    api-client.ts          # fetch wrapper: envelope unwrap, ApiError(code), no-store
    socket.ts              # Socket.IO singleton: connect, join, action, typed events
    session-store.ts       # reconnect tokens (sessionStorage per PRD §11), hostId/playerId
  api/                     # React Query hooks — ONE per endpoint, no fetch in components
    use-create-room.ts     # useMutation → POST /rooms
    use-join-room.ts       # useMutation → POST /rooms/:code/players
    use-lobby.ts           # useQuery  → GET /rooms/:code  (seeds lobby before socket)
    use-start-game.ts      # useMutation → POST /rooms/:code/start
    use-start-league.ts    # useMutation → POST /rooms/:code/league
    use-league-standings.ts
  realtime/
    use-room-socket.ts     # connect + join by role; exposes { view, status, error }
    room-view-context.tsx  # provider: holds latest patch per audience; screens read it
```

- **TanStack Query** for all REST (matches the locked stack; caching, retry-on-code, invalidation).
- **One socket singleton**; a `RoomSocketProvider` joins on mount with the right role and feeds
  `server.view` patches into context. In-game screens subscribe to the patch, render it.
- **No `any`**: every endpoint + every `server.view` patch gets a typed model (`shared/types`).
  Patch types are authored from the live probe (§4), Zod-parsed at the socket boundary
  (hard-lessons: "type external data with `?.` until parsed").
- **`error.code` switch**: `ApiError` carries `code`; the existing edge-state screens (§8) map
  codes → treatments (`room_not_found`, `room_full`, `nickname_taken`, `not_enough_players`, …).
  These already exist as UI — now they get triggered for real.

## 4. Step 0 (before screen wiring): probe the live view payloads

Add `socket.io-client`, write a throwaway probe script that:
1. `POST /rooms` (host), `POST /rooms/:code/players` ×3 (players),
2. connects 3 sockets (host/display/player), `client.join` each,
3. `POST /rooms/:code/start { gameId }` for each real game (`quizzes`, `wordshot`, `word_bomb`,
   `hot_take_court`, `plead_your_case`),
4. logs every `server.view { audience, patch }`.

Output → the authoritative patch schemas. **This removes the only guesswork.** (Real games
only: the spec ships 18 UI games but the backend implements 5 + 2 test games — see §7.)

## 5. Wiring order (incremental, each verifiable end-to-end)

1. **Plumbing**: env, api-client, socket, session-store, RoomSocketProvider, QueryClient in
   `app.tsx`. Install `@tanstack/react-query` + `socket.io-client` (pinned).
2. **Create/join flow** (REST): landing "Start a room" → `POST /rooms` → real code; `/join` →
   `GET /rooms/:code` validate → `POST /rooms/:code/players` → store `reconnectToken` → lobby.
3. **Lobby (live)**: seed from `GET /rooms/:code`, then live player joins via `server.view`
   (display/player/host lobbies stop using the mock roster).
4. **Start game** (host): catalogue/configure → `POST /rooms/:code/start { gameId, config }`.
   Config maps from our data-driven schema → the documented per-game `config` fields.
5. **In-game (live)**: the 5 real games render from `patch`; `client.action` on input.
6. **Post-game / league**: final board + `GET /rooms/:code/league/standings`.
7. **Edge + recovery**: wire `server.room_suspended/ended/resumed` + reconnect-token replay to
   the §8 banners/screens already built.

Mock stays the fallback for the 13 not-yet-backed games (§7) so the gallery never regresses.

## 6. Decisions to lock before building

- **D1 — Routes**: adopt the backend's `/display/:code` + `/join/:code`, or keep ours and map?
- **D2 — Real-vs-mock games**: backend has 5 real games. Wire those to live; keep the other 13
  on mock (clearly flagged) — or hold all wiring until the backend has more games?
- **D3 — Config mapping**: our configure schema is richer than the documented `config` fields
  for each game. Send only documented fields (drop extras) — confirm.
- **D4 — Auth scope now**: wire host accounts (`/host/register|login`) + admin app, or just the
  unauthenticated room/play flow first?
- **D5 — Deps**: add `@tanstack/react-query` + `socket.io-client` (+ `zod` for patch parsing) —
  pinned exact, per the security rule.

## 7. Real vs mock games (from api-docs §start)

Backend `gameId` ∈ `quizzes`, `wordshot`, `word_bomb`, `hot_take_court`, `plead_your_case`
(+ `test_simultaneous`, `test_round_robin`). The other 13 UI games have no engine yet → they
stay on the mock content registry, surfaced in `/preview-screens`, until their plugins land.

---

## 8. Probe results (captured from the live backend)

Confirmed shapes from `scripts/probe-views.mjs`. **Every patch is `{ audience, patch }`**;
`patch.phase` is the discriminant. The **player** patch = display patch **plus** `your*`
fields. The **host socket receives the `player` audience view** (host plays as a player).

```jsonc
// quizzes — phase "question"
display: { phase, qIndex, rounds, prompt, options: string[] }
player:  { ...display, answered: boolean }

// wordshot — phase "round"
display: { phase, roundIndex, rounds, letter, category, ranked: [] }
player:  { ...display, yourScore: number, yourSubmission: string|null }

// word_bomb — phase "holding"
display: { phase, round, rounds, category, holderId, used: string[] }
player:  { ...display, yourTurn: boolean, yourScore: number }

// hot_take_court — phase "submission"
display: { phase, roundIndex, rounds, prompt, defences: [] }
player:  { ...display, submitted: boolean, voted: boolean, ownDefenceId: string|null }

// plead_your_case — phase "writing"
display: { phase, roundIndex, rounds, scenario: { charge, defendant, facts, laws, precedents } }
player:  { ...display, submitted: boolean }
```

Reveal/leaderboard/done phases follow the engine's phase model (game-engine.md §0.5):
quizzes `question→reveal→done`; word games `round→reveal→leaderboard`. Exact reveal-patch
fields to be confirmed when the backend is stable enough to drive a full round (see issues).

### Issues found against the live backend (NOT frontend bugs)
- **B1 — quizzes content unseeded:** `POST /rooms/:code/start { gameId:'quizzes' }` returns
  `422 validation_error` `content.questions: "at least 1 element"` after the first run — no
  quiz_deck content available. The other 4 games start fine. Needs a seeded quiz deck.
- **B2 — backend instability:** the server intermittently drops (`ECONNREFUSED` on :8090)
  then returns — restarts under load mid-probe. Wiring will lean on reconnect logic (which
  we're building anyway), but the backend needs to stay up for a clean full-phase capture.
- **B3 — config validation:** passing `config.rounds` can trip `content.questions` when the
  requested count exceeds seeded content. Config mapping (D3) must send conservative fields.
