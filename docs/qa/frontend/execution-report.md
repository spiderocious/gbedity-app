# QA Execution Report — Frontend Live Integration (Room → Play → Result + Admin)

**Date:** 2026-05-31
**Tester:** Claude (frontend QA persona)
**Build:** `main` @ `f821e34` — **note: in-game + post-game files were under active concurrent edits during this run** (see git status); several findings reflect a refactor that landed mid-session.
**Backend:** `http://localhost:8090` (up · `GET /api/v1/health` → `{status:"ok"}`)
**Game client:** `http://localhost:5173` (up) · **Admin:** `http://localhost:5174` (started during run)
**Auth (admin):** `admin@gbedity.test` (creds supplied by user) · **Players:** nickname-only, driven via named `agent-browser` sessions (`player`, `display`, `admin`) for isolation.
**Live rooms used:** `Q9F8KX` (seeded, 5 players), `AJCZJ7` (host-created via UI, full live-play rig).
**Screenshots:** `docs/qa/frontend/screenshots/` (33 files)
**Plan:** `docs/qa/frontend/test-plan.md`

---

## Summary

| Phase | Pass | Fail | Blocked | Skip | Notes |
|-------|------|------|---------|------|-------|
| Pre-flight | 6 | 0 | 0 | 0 | services up, room+players seeded |
| RM — Room creation | 5 | 1 | 0 | 1 | **BUG-02** (League) FAIL |
| JN — Join | 9 | 0 | 0 | 0 | JN-11/JN-12 = P3 UX quirks (not fails) |
| LB — Lobbies | 6 | 1 | 0 | 0 | **BUG-04** roster no live-update |
| CFG — Catalogue/Configure | 8 | 0 | 0 | 0 | K3 config no-op confirmed (known) |
| ST — Start | 5 | 0 | 0 | 0 | **K1 RESOLVED** (quizzes starts) |
| LP — Live play | 10 | 0 | 0 | 1 | **BUG-01 now FIXED by refactor**; K4 thin reveal |
| PG — Post-game | 4 | 1 | 0 | 0 | **K5** single-game result mock — FAIL |
| RC — Recovery/errors | 5 | 0 | 0 | 2 | network-abort tooling SKIP |
| AD — Admin | 9 | 0 | 0 | 0 | unblocked by creds; all green |
| **Total** | **67** | **4** | **0** | **5** | |

**Headline:** The core **live loop works end-to-end** — host creates a real room, players join, host starts a backed game, and players/display render live socket state and submit actions, agreeing across surfaces. The 4 FAILs are: a broken **League entry point** (BUG-02), **lobby roster that doesn't live-update** (BUG-04), **single-game results showing fabricated mock data** (K5), and these sit alongside several mock-screen leaks of `GBE-4ZK`.

> **The single biggest plan-vs-reality delta:** my pre-test source audit flagged **BUG-01** (players auto-advance into the *mock* game). During the run the in-game screens were **refactored to be live-by-default with patch-shape detection** (`detectLiveGame`), and the browser proves players now reach the live view correctly. **BUG-01 is FIXED.** This is exactly why source review can confirm a bug but only the browser confirms a pass.

---

## Pre-flight Notes

- Backend, game dev, and (after a `nx dev admin`) admin dev all came up clean.
- Seeded `Q9F8KX` with QAHost/Ada/Bola/QAPlayer/Chidi via REST; created `AJCZJ7` through the UI to get a real host session, then joined Ada/Bola/LivePlayer for the multi-surface rig.
- Live envelope shapes match the client Zod schemas exactly (`{data:{code,hostId,hostToken,display_url,join_url}}`, error `{code,message,field_errors}`).

---

## RM — Room creation · `/host/new` → `/host/room/:code`

| ID | Result | Notes |
|----|--------|-------|
| RM-01 | **PASS** | Three modes render (Quick / Create / League). |
| RM-02 | **PASS** | Quick Play → `POST /rooms` **201** → `/host/room/KCBECV` (real 6-char code, **not** GBE-4ZK). |
| RM-03 | **PASS** | Host lobby shows live code + "Open the shared screen →". |
| RM-04 | **PASS** | Host is first roster entry, tagged `(YOU · HOST)`. |
| RM-05 | **PASS** | Create Game also creates a real room → host lobby. |
| RM-06 | **FAIL** | **BUG-02** — see below. |
| RM-08 | **SKIP** | Double-click guard not isolated cleanly under automation; `createRoom.isPending` guard present in source. |

---

## JN — Player join

| ID | Result | Notes |
|----|--------|-------|
| JN-01 | **PASS** | Valid `Q9F8KX` → `GET /rooms/Q9F8KX` **200** → `/join/nickname?code=Q9F8KX`. |
| JN-02 | **PASS** | `ZZZZZZ` → `GET …/ZZZZZZ` **404** → toast "Couldn't find that room…", stayed on `/join`. |
| JN-03 | **PASS** | `ABC` → inline "Six characters needed.", no API call. |
| JN-04 | **PASS** | Auto-formats to `ZZZ-ZZZ` / `Q9F-8KX`. |
| JN-05 | **PASS** | Deep-link `/join/Q9F8KX` pre-fills `Q9F-8KX` (**K7 verified**). |
| JN-06 | **PASS** | Nickname pre-fills a suggestion ("BoldOkra"). |
| JN-07 | **PASS** | Join → `POST …/players` **201** → `/lobby/Q9F8KX`; reconnect token + playerId stored in `sessionStorage`. |
| JN-08 | **PASS** | Joining as "Ada" (taken) → `POST …/players` **409** → inline "That nickname's taken." |
| JN-11 | **PASS** (quirk) | **P3 UX:** clearing the nickname field re-injects a *new* suggestion ("SwiftEgusi") — you cannot leave it blank. Harmless but surprising. |
| JN-12 | **PASS** (quirk) | **P3:** in-app QR mock scan lands on `/join/nickname` with **no `?code`** → submitting bounces to `/join`. The QR is mock/out-of-scope; the real QR target `/join/:code` works (JN-05). |

---

## LB — Lobbies

| ID | Result | Notes |
|----|--------|-------|
| LB-01 | **PASS** | Player lobby shows live roster (QAHost, Ada, Bola, QAPlayer). |
| LB-02 | **FAIL** | **BUG-04** — added Chidi via API; display lobby stayed "4 joined" for 3.5s. Only a **manual reload** showed "5 joined / Chidi". Roster does not live-update. |
| LB-04 | **PASS** | Own pill marked `(YOU)`; "QAHost's room" heading reads `players[0]`. |
| LB-05 | **PASS** | Display lobby (landscape) shows QR + hero code + roster aside. |
| LB-06 | **PASS** | `/display/Q9F8KX` canonical entry renders code + QR + roster (**K7 verified**). |
| LB-07 | **CONFIRMED (source)** | **CC-08 / P3:** QR encodes `http://localhost:5173/join/${code}` (hardcoded host) — breaks off-localhost. URL is inside the canvas, not DOM. |
| LB-09 | **PASS** | "Leave room" → confirm drawer ("Leave the room?") → "Leave" → routes to `/`. |

---

## CFG — Catalogue & Configure

| ID | Result | Notes |
|----|--------|-------|
| CFG-01 | **PASS** | Catalogue renders tiles + category filters. |
| CFG-02 | **PASS** | "Pick a game" → `/host/catalogue?code=AJCZJ7` (code threaded). |
| CFG-03 | **PASS** | Wordshot tile → `/host/configure/5?code=AJCZJ7`. |
| CFG-04 | **PASS** | Configure renders full config groups (Round / Categories / Difficulty) + live preview rail. |
| CFG-05 | **PASS** | "Add to room" → toast "Wordshot added." → host lobby with queued row. |
| CFG-06 | **PASS** | Backed game has no "Preview only" tag (mock games do). |
| CFG-07 | **CONFIRMED** | **K3 / known:** queue stored with `config:{}`; the start hook only sends `config` when non-empty, so config controls have zero live effect. |
| CFG-08 | **PASS** | Queue persists in `sessionStorage` (`gbedity:queue:AJCZJ7`) across the round-trip. |

---

## ST — Starting a game

| ID | Result | Notes |
|----|--------|-------|
| ST-01 | **PASS** | ▶Start Wordshot → `POST /rooms/AJCZJ7/start` **201** → host nav `/d/AJCZJ7/game?live=wordshot`. |
| ST-02 | **PASS — K1 RESOLVED** | Quizzes **starts** now (`{data:{instanceId}}`), not the 422 the handoff warned of. Quiz decks are seeded (visible in admin Content: "Science", "Afrobeats & Pop", etc.). **Recommend downgrading/closing K1.** |
| ST-03 | **PASS** | Solo room start → backend `not_enough_players` "Not enough players for that game yet." (**K2** confirmed by design). |
| ST-04 | **PASS** | Starting a running game → `game_already_running` coded. |
| ST-05/06 | **PASS** | Display-lobby "Start game" defaults to wordshot when host session present; previews shell when not. |

---

## LP — Live play (Socket.IO) — **the core loop works**

Rig: host (`/host/room/AJCZJ7`) + player session "LivePlayer" + display session, all on room `AJCZJ7`, Wordshot.

| ID | Result | Notes |
|----|--------|-------|
| LP-01 | **PASS — BUG-01 FIXED** | After host start, player auto-advances to `/p/AJCZJ7/game` (no `?live`, as predicted) **but renders the LIVE view anyway** — the screens were refactored to be live-by-default and pick the renderer from patch shape (`detectLiveGame`). Player shows live "D · ANIMAL", live "YOU: 0 PTS", working input. **No mock toggle present.** |
| LP-02 | **PASS** | Display renders live opening: "Wordshot · ROUND 4/10 · ANIMAL · D" (phase `round`). |
| LP-03 | **PASS** | Player typed "Dog" + Submit → input cleared → `client.action` emitted (invalid for CURRENCY, scored 0, correctly). |
| LP-09 | **PASS** | Answer secrecy — player sees only own score, no other submissions/answer leaked. |
| LP-11 | **PASS** | Display and player agree on the round letter/category ("CURRENCY"="CURRENCY") and round number. |
| LP-12 | **PASS** | Player header "YOU: 0 PTS" tracks `patch.yourScore`. |
| LP-10 | **SKIP / partial (K4)** | Rounds advanced live (4→5→8→9/10). Reached `reveal` phase but the display rendered just **"…"** (empty `LiveBoard` — no `board`/`ranked` rows in the inter-round reveal patch), then resumed the next round. **K4 confirmed:** later phases render thin/blank. Couldn't capture a populated final leaderboard before the game cycled. |
| RC-04 | **PASS** | (recovery) Player refresh mid-game → socket rejoined with stored token, re-rendered live, no hang. |

**CC-06 (P2) — host live-game screen still mock:** `/host/room/AJCZJ7/game` renders `GBE-4ZK`, "Word Bomb", hardcoded "Round 2 · 3 left", "Tobi's turn / amala / akara". It is **not** in the live nav path (host goes to display on start; only the mock post-game "Play again" reaches it via `?mock=`), so low blast radius — but it leaks `GBE-4ZK` if opened directly.

---

## PG — Post-game results

| ID | Result | Notes |
|----|--------|-------|
| PG-01 | **FAIL** | **K5 confirmed (P1).** After a real Wordshot game in `AJCZJ7`: **display result** shows mock "Word Bomb · Ada 1420 / Tobi 1180 / Funmi 940 / Kemi 720"; **player result** shows `GBE-4ZK` + "You came 3rd · 940 pts". Real players see fabricated names, scores, and the wrong game. |
| PG-02 | **PASS** | Result chrome (celebration + winner bar + ranked rows + actions) renders. |
| PG-04 | **PASS (partial-live)** | League result uses `GET /rooms/:code/league/standings` + lobby names; resolves live when a league runs. |
| PG-05 | **PASS** | No league running → `standings` **404** → graceful mock-podium fallback, no crash. |
| PG-06 | **PASS (mock)** | Round-detail renders but is mock (`GBE-4ZK`, "Round 2 detail", mock players) — CC-06 category. |

---

## RC — Recovery & error surfacing

| ID | Result | Notes |
|----|--------|-------|
| RC-01 | **SKIP** | `agent-browser network route --abort` did not intercept the `fetch` in this tool version (navigation succeeded). The network-error path is exercised indirectly — `api-client` maps fetch failure → `network_error` "Could not reach the server." (source-confirmed). |
| RC-04 | **PASS** | Player refresh mid-game → reconnects with stored `reconnectToken`/`playerId`, live re-render. |
| RC-05 | **PASS** | Named sessions have **isolated** `sessionStorage` (distinct playerIds; display has none) — confirms incognito-style isolation. Same-profile bleed remains the documented constraint. |
| RC-08 | **PASS** | `not_enough_players` coded error from backend, clear message. |
| RC-09 | **PASS** | Coded-error mapping verified across `room_not_found` (JN-02), `nickname_taken` (JN-08), `not_enough_players` (RC-08), `game_already_running` (ST-04) — each a specific message, never a blank crash. |
| RC-02/03 | **SKIP** | `room_suspended`/`room_ended` not triggerable without orchestrating a host-disconnect; status wiring present in `room-socket-provider`. |

---

## AD — Admin (`http://localhost:5174`) — unblocked by credentials

| ID | Result | Notes |
|----|--------|-------|
| AD-02 | **PASS** | Wrong creds → `invalid_credentials` → inline "Wrong email or password." (no toast). |
| AD-03 | **PASS** | Guard redirects `/` → `/login` when unauthed. |
| AD-04 | **PASS** | Valid login → `POST /admin/login` **200** → `/` shell; refresh token in `sessionStorage`. |
| AD-05 | **PASS** | Content lists per kind; quiz decks/hot-take prompts render live (seeded data visible). |
| AD-06 | **PASS** | Create via paste-JSON works ("Garri underrated" appeared in list). Invalid JSON → "That isn't valid JSON."; a 422 (my bad `tags` enum) rendered the coded validation error gracefully (bonus error-path coverage). |
| AD-07 | **PASS** | Delete → destructive confirm → `DELETE` → row removed. |
| AD-08 | **PASS** | Metrics render live per-game cards (WORD_BOMB 8, WORDSHOT 7, … — real aggregates incl. games run this session). |
| AD-09 | **PASS** | Rubric editor loads criteria (Legal soundness 0.4 / Persuasiveness 0.35 / Use of precedent 0.25); Save → "Rubric saved." |
| AD-10 | **PASS** | Loading/error/empty states observed across content + 422 path. |

**AD note (P2/P3):** admin access token is **memory-only**; a hard navigation or refresh logs the admin out (no refresh-on-load using the stored refresh token). Reproduced: a direct `navigate` to `/content` bounced to `/login`; in-app sidebar nav works. The refresh token is stored but never used to re-hydrate the session.

---

## New / Confirmed Bugs

### BUG-02 — League Play entry point is a mock dead-end that leaks `GBE-4ZK` (P1)
**Files:** `catalogue/screen/league-builder-screen.tsx:93`, `onboarding/screen/host-start-screen.tsx:43`
Host → "League Play" creates a **real** room (`?code=K4R35D` observed) but routes to `LeagueBuilderScreen`, which ignores the live code, is pre-seeded with 3 sample games, and whose "Start league" navigated to **`/host/room/GBE-4ZK/display`** with **no `POST /rooms/:code/league`** call (HAR confirmed: zero league requests). The working league start lives only in the host lobby (`startLeagueRun`, reachable by queuing ≥2 games). So the advertised League entry point cannot start a real league.
**Fix:** Either (a) wire `LeagueBuilderScreen` to the live room — thread `?code`, build the queue from real backed games, and call `useStartLeague` on "Start league"; or (b) drop the separate builder and route "League Play" into the host-lobby queue flow that already works. Remove the `mockPath(DISPLAY_LOBBY)` navigation.

### BUG-04 — Lobby roster does not live-update (P2)
**File:** `shared/api/use-lobby.ts` (consumed by host/player/display lobbies)
`useLobby` has `staleTime: 2000` and **no `refetchInterval`**, and the lobby roster renders from this REST query — **not** from the socket. Adding a player via API did not appear on an open display lobby until a manual reload (backend was correct: reload showed the new player). The hook's comment says "the socket is the live source," but the socket patch is only consumed for phase auto-advance, never to update the roster. Contradicts handoff §3.1 ("players appear as they join").
**Fix:** Add `refetchInterval` (e.g. 2–3s while `phase==='lobby'`) to `useLobby`, **or** drive the roster from a `server.view` lobby patch and invalidate `lobbyQueryKey` on socket join/leave events.

### BUG-03 / mock-code leaks — `GBE-4ZK` reaches live-reachable screens (P2)
**Files:** `shared/realtime/use-room-code.ts:15` (fallback); mock screens `host-game-screen.tsx`, `host-result-screen.tsx`, `player-result-screen.tsx`, `round-detail-screen.tsx`, and the BUG-02 path.
Observed `GBE-4ZK` rendered on: league "Start league" destination, host in-game screen, player result, round detail. Handoff §6.1 flags any `GBE-4ZK` appearance as a real bug.
**Fix:** Remove the `MOCK_ROOM_CODE` fallback from `useRoomCode` for live screens (render an explicit "no room" state instead); migrate the remaining mock screens (host-game, single-game results, round-detail) to live data (overlaps K5/CC-06).

### Known gaps re-confirmed (not new, but verified in-browser)
- **K5 (P1)** — single-game result screens fully mock-fed → players see fabricated outcomes. (PG-01)
- **K4 (P2)** — reveal/leaderboard live render is thin; inter-round reveal shows "…". (LP-10)
- **K3 (P2, by design this pass)** — config never sent (`buildStartConfig()` → `{}`). (CFG-07)
- **CC-06 (P2)** — host-game + round-detail screens still mock. (LP, PG-06)
- **CC-08 (P3)** — display QR hardcodes localhost. (LB-07)

### Resolved since handoff
- **BUG-01 (was P1) → FIXED** — players reach the live view via patch-shape detection refactor. (LP-01)
- **K1 → RESOLVED** — quizzes starts; decks seeded. (ST-02)
- **K7 → VERIFIED** — `/join/:code` + `/display/:code` route and pre-fill. (JN-05, LB-06)

---

## Priority Fix List

### Must fix before sign-off
1. **K5 / BUG-03** — single-game result screens show fabricated mock data after real games (players see wrong scores + `GBE-4ZK`). Wire `/d/:code/result` and `/p/:code/result` to a live terminal patch.
2. **BUG-02** — League Play entry point can't start a real league and leaks `GBE-4ZK`.

### Should fix before launch
3. **BUG-04** — lobby roster doesn't live-update (players appear only on reload).
4. **K4** — populate reveal/leaderboard/final render; "…" is not acceptable for end-of-round.
5. **Admin session** — use the stored refresh token to re-hydrate on load so refresh/deep-link doesn't log admins out.

### Code quality / post-MVP
6. **CC-06** — migrate host-game + round-detail off mock; remove `useRoomCode` mock fallback for live screens.
7. **K3** — send real config once the backend tolerates it.
8. **CC-08** — derive the QR origin from env, not hardcoded localhost.
9. **JN-11/JN-12** — let the nickname field be blank; carry the code through the QR mock (or hide it).

### Close out
10. **K1** — quizzes starts; mark resolved.

---

## Screenshots (33)

Key evidence: `rm-league-start-result.png` (GBE-4ZK leak), `lp-player-view-after-start.png` + `lp-display-wordshot.png` (BUG-01 fixed, live play), `lp-host-game.png` (CC-06 mock leak), `lp-display-later-phase.png` (K4 "…" reveal), `pg-display-result.png` + `pg-player-result.png` (K5 mock results), `lb-roster-update.png` (BUG-04), `ad-metrics.png` / `ad-rubric.png` / `ad-content-saved.png` (admin live).
