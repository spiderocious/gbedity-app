# Frontend Integration — QA Handoff

**Scope of this doc:** only the parts of the frontend that are **wired to the live backend**.
Pure-UI screens (the 13 mock-only games, the static gallery) are out of scope here — see the
screens spec for those. This is for testing the real room → play → result flow and the admin
operator surface against `http://localhost:8090`.

**Status:** first integration pass. Builds/typecheck/lint are green and a render smoke test
covers every screen, but **end-to-end live play has had very little manual testing** — that's
what this handoff is for. Expect bugs; please log generously.

---

## 1. What to run

| Piece | How | URL |
|---|---|---|
| Backend | (owned by backend team) | `http://localhost:8090` — must be up; `GET /api/v1/health` → `{status:"ok"}` |
| Game client | `nx dev game` | `http://localhost:5173` |
| Admin client | `nx dev admin` | `http://localhost:5174` |

Client config defaults to the local backend; override with `VITE_API_BASE_URL` /
`VITE_WS_URL` (see `apps/game/.env.example`).

**Backend stability note:** during development the backend repeatedly dropped (`ECONNREFUSED`)
and restarted. If the client shows "Could not reach the server" or a stuck "Reconnecting…",
**check the backend is actually up first** before logging it as a client bug.

---

## 2. Transport model (how it works — context for triage)

- **REST** (`/api/v1`) handles setup: create room, join, lobby snapshot, start game/league,
  league standings, and all admin endpoints. Errors are coded (`error.code`); the client maps
  codes → messages.
- **Socket.IO** handles live play. The server pushes `server.view { audience, patch }`; the
  client renders the patch. The client does **not** compute game state — if a live screen
  shows wrong/stale data, it's most likely the patch (backend) or our render of it, not local
  logic. Worth noting when filing.
- **Roles:** `host`, `player`, `display` — separate clients/tabs join the same room code.

---

## 3. What's wired (test these)

### 3.1 Room lifecycle (REST)
- **Create room** — landing → "Start a room" → Host start → choosing a mode does `POST /rooms`
  and lands on the **host lobby** showing the real room code + share link.
- **Join** — `/join` → enter code (validated via `GET /rooms/:code`) → nickname →
  `POST /rooms/:code/players` → player lobby. Deep link `/join/:code` pre-fills the code.
- **Lobby (live roster)** — host/player/display lobbies poll `GET /rooms/:code`; players appear
  as they join.

### 3.2 Game setup (host)
- **Catalogue → Configure → "Add to room"** — configure is prep only; it adds the game + config
  to a room-local queue and returns to the room. **Start happens in the room**, per game row.
- **Start single game** — a game row's ▶ Start does `POST /rooms/:code/start`.
- **Start league** — 2+ queued (backed) games → "Start league" does `POST /rooms/:code/league`.

### 3.3 Live play (Socket.IO) — **5 backed games only**
`wordshot`, `word_bomb`, `hot_take_court`, `plead_your_case`, `quizzes`.
- Display view renders public state; player view renders the per-player state + input;
  submitting sends `client.action`.
- The player/display lobby **auto-advances** into the game when the host starts.

### 3.4 Admin (REST) — `http://localhost:5174`
- **Login** (`/admin/login`), guarded shell.
- **Content CRUD** for `quiz_deck`, `word`, `hot_take_prompt`, `plead_scenario` (list, create
  via paste-JSON, delete).
- **Metrics** (`/admin/metrics`) + recent game-plays; **Rubric editor** (`/admin/rubric`).

---

## 4. How to drive a full multiplayer session (no second device needed)

You need **2+ players** — every game enforces a minimum (`not_enough_players` otherwise). Use
separate browser profiles/incognito windows so each tab is a distinct player session
(sessions are keyed in `sessionStorage`; same-profile tabs share it and will clobber).

1. **Window A (host):** `http://localhost:5173/` → Start a room → Quick Play → host lobby.
   Note the room code.
2. **Window B (incognito):** `http://localhost:5173/join/<CODE>` → nickname → joins.
3. **Window C (incognito):** same again, different nickname → now 2+ players.
4. **Window A:** Pick a game → **Wordshot** → Configure → Add to room → back in room → ▶ Start.
5. Play from B and C; watch the display (open `/host/room/<CODE>/display` or `/display/<CODE>`).

A jump page listing every screen with direct links lives at **`/preview-screens`**.

---

## 5. KNOWN ISSUES — already aware, please verify/expand, don't just re-log these

These are flagged so you can confirm severity + find the edges, not so they're hidden:

| # | Area | Issue | Expected? |
|---|---|---|---|
| K1 | Start game | **Quizzes does not start** — backend returns `422 content.questions: at least 1 element`. Its quiz deck is unseeded. The other 4 games start fine. | Backend data gap, not client |
| K2 | Start game | **Solo start fails** with "not enough players" — this is the backend's `min` rule (≥2). Not a bug; confirm the message is clear. | By design |
| K3 | Config | Configure controls render but **config is NOT sent** to the backend yet (we send engine defaults only — sending `rounds` etc. can 422 against seeded content). So changing config sliders/steppers has **no live effect**. | Known limitation this pass |
| K4 | Realtime | **Reveal / leaderboard / end-of-game phases are under-tested** — we captured the opening phase of each game from the live server but not the full round → reveal → final-board sequence. Live render of later phases may be wrong/blank. | Needs QA |
| K5 | Post-game | The **single-game result screen** (`/d/:code/result`) is not yet fed by a live terminal patch — it may show mock/placeholder data after a real game ends. | Known gap |
| K6 | Recovery | `server.room_suspended` / `room_ended` / reconnect are wired to status but the **full recovery UX (60s host-left grace, reclaim seat) is lightly tested**. | Needs QA |
| K7 | Routes | Backend's `join_url` (`/join/:code`) and `display_url` (`/display/:code`) were **not registered** — scanning the backend's join/display QR 404'd. **Fixed in this pass** (both now route in); please verify the QR/deep-link entry actually lands and pre-fills. | Fixed — verify |
| K8 | Plead Your Case | AI verdict needs a real `OPENAI_API_KEY`; with the placeholder it degrades to "evaluation failed". Verdict screen behaviour under that degrade path is untested. | Env-dependent |
| K9 | Admin | Admin needs a **seeded admin account** to log in (`POST /admin/seed`, env-gated `CAN_SEED_ADMIN=true`). No seed UI in the client — must be seeded out-of-band. Login against an unseeded backend will fail. | Setup dependency |

---

## 6. Where bugs most likely hide (suggested test focus)

1. **Code threading** — the live room code must survive every hop (room → catalogue →
   configure → room → display). If you ever see the code **`GBE-4ZK`** appear, that's the
   **mock fallback leaking** — a real bug. Real codes are 6 chars like `4NSVDP`.
2. **Multi-tab session bleed** — joining as two players in the same browser profile; the
   second join may overwrite the first's reconnect token. Confirm incognito isolation works.
3. **Socket lifecycle** — navigating away mid-game, refreshing a player tab, backgrounding —
   does the socket reconnect and re-render, or hang?
4. **Error surfacing** — bad room code, room full (cap 50), nickname taken, starting under
   min players, host-only actions as a non-host — each should show a clear coded message, not
   a blank screen or a generic crash.
5. **Display ↔ player ↔ host consistency** — the same round on three surfaces; do they agree?
   Answer secrecy: a player must never see another player's submission or the answer early.
6. **The 13 mock games** — they render but DON'T connect; confirm they never *appear* live
   (no fake "live" state) and that picking one is clearly preview-only in the room queue.

---

## 7. Out of scope for this handoff
- The 13 non-backed games' gameplay (mock only — no backend engine exists yet).
- Visual/design polish (separate design review).
- Host accounts (`/host/register|login`) — endpoints exist, not wired into the client UI yet.
- Performance / load (2G/3G tolerance, burst submission) — not exercised.

---

## 8. Filing bugs
Please capture: **role** (host/player/display), **room code**, **game**, **the exact step**,
**what the screen showed vs expected**, and whether the **backend was up** at the time
(`/api/v1/health`). For live-play issues, note the **phase** shown (question/round/holding/
submission/writing/reveal/leaderboard) — that pins it to a patch shape.
