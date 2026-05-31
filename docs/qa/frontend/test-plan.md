# Test Plan — Frontend Live Integration (Room → Play → Result + Admin)

**Prepared:** 2026-05-31
**Spec / handoff:** `docs/qa/frontend/integration-handoff.md` · `docs/backend/api-docs.md` · `dockito/projects/gbedity/prd.md`
**Build:** `main` @ `f821e34`
**Scope:** Only the frontend wired to the live backend (`http://localhost:8090`). The 13 mock-only games' gameplay, visual polish, and host-account auth are **out of scope** (handoff §7).
**Backend:** `http://localhost:8090` · `GET /api/v1/health` → `{status:"ok"}` (confirmed up)
**Game client:** `nx dev game` → `http://localhost:5173` (confirmed up)
**Admin client:** `nx dev admin` → `http://localhost:5174` (was DOWN at plan time — start before admin phase)
**Screenshots →** `docs/qa/frontend/screenshots/`
**Player seeds:** no accounts — players are nickname-only. Use **incognito windows / named browser sessions** per player (sessions live in `sessionStorage`; same-profile tabs clobber — handoff §6.2).
**Admin seed:** an admin already exists on this backend (`POST /admin/seed` → `409 conflict`). **Admin login is BLOCKED until out-of-band credentials are supplied** (handoff K9).

---

## How to read this plan

Three device contexts share a room code: **host** (`/host/*`), **player** (`/join`, `/lobby/:code`, `/p/:code/*`), **display** (`/display/:code`, `/host/room/:code/display`, `/d/:code/*`). REST does setup; Socket.IO does live play (`server.view { audience, patch }`). The client never computes game state — wrong/stale live data is most likely the patch or our render of it (handoff §2).

Test IDs are hierarchical: `PF` pre-flight, `CC` cross-cutting source audit, then per-phase (`RM` room, `JN` join, `LB` lobby, `CFG` configure, `ST` start, `LP` live play, `PG` post-game, `RC` recovery/errors, `AD` admin). Bug probes are marked **Bug to verify** and tie back to a `BUG-*`/`CC-*`/`K*` id.

---

## Pre-flight

| ID | Step | Expected |
|----|------|----------|
| PF-01 | `curl http://localhost:8090/api/v1/health` | `{"status":"ok",...}` |
| PF-02 | `curl -s http://localhost:5173 \| head -1` | `<!doctype html>` |
| PF-03 | `curl -s http://localhost:5174 \| head -1` (admin) | HTML; if empty, `nx dev admin` first |
| PF-04 | Seed a live room via API for direct-link tests: `POST /rooms {nickname:"QAHost"}` | `{ data: { code, hostId, hostToken, display_url, join_url } }` — capture `CODE`/`HOST` |
| PF-05 | Add 2 players so games can start (min 2, handoff K2): `POST /rooms/$CODE/players {nickname:"P1"}` ×2 | each → `{ data: { code, playerId, reconnectToken } }` |
| PF-06 | Confirm `agent-browser` daemon clean: `agent-browser close --all` | no error |

> **Never seed test data through the UI.** Seed rooms/players via the REST calls above, then drive the UI.

---

## Cross-Cutting Audit (Source Review) — findings before execution

Greps run across `apps/game/src` + `apps/admin/src`. Severity: **P0** app-breaking · **P1** core flow broken / silent failure · **P2** degraded UX · **P3** code quality.

### Critical bugs found in source (must verify in browser)

| ID | Bug | File | Severity |
|----|-----|------|----------|
| **BUG-01** | **Players auto-advance into the MOCK game, not the live one.** When the host starts a real game, the player lobby navigates to `PLAYER_GAME` with only `{code}` — **no `?live=<backendId>`**. `PlayerGameScreen` reads `?live` to choose `LivePlayer` vs `MockPlayer`; without it, every player lands on the static `MockPlayer` preview (Active/Waiting/Spectator toggle) and can **never submit a live answer**. The display path sets `?live=` correctly (`host-lobby-screen.tsx:37`); the player path drops it. The patch (`ViewPatch`) carries no `gameId`, so the player screen has no way to recover it. | `lobby/screen/player-lobby-screen.tsx:42` (vs `host-lobby-screen.tsx:37`) | **P1** |
| **BUG-02** | **League Play mode is a mock dead-end.** Host start → "League Play" creates a real room then routes to `LeagueBuilderScreen` (`host-start-screen.tsx:43`). That screen ignores the live `?code`, is pre-seeded with 3 sample games, and "Start league" goes to `mockPath(DISPLAY_LOBBY)` = **`GBE-4ZK`** — it never calls `POST /rooms/:code/league`. The *working* league start lives elsewhere (`host-lobby-screen.tsx:47 startLeagueRun`), reachable only by queuing ≥2 games in the room. So the advertised League entry point can't start a real league. | `catalogue/screen/league-builder-screen.tsx:93`; `onboarding/screen/host-start-screen.tsx:43` | **P1** |
| **BUG-03** | **`useRoomCode` mock fallback can leak `GBE-4ZK` into live screens.** Final fallback returns `MOCK_ROOM_CODE` when no param/query/session code resolves. Any wired screen that loses the code (deep-link, refresh without session, navigation that drops the param) will silently operate on the mock room. Handoff §6.1 calls `GBE-4ZK` appearing a real bug. | `shared/realtime/use-room-code.ts:15` | **P2** |

### Known gaps confirmed in source (handoff §5 — verify behaviour, don't re-log existence)

| ID | Gap | File | Maps to |
|----|-----|------|---------|
| CC-04 | Config is never sent — `buildStartConfig()` returns `{}` unconditionally. Configure sliders/steppers have zero live effect. | `shared/games/config-map.ts:26` | **K3** |
| CC-05 | Single-game result screens are 100% mock-fed (`LEADERBOARD`, "You came 3rd", `MOCK_ROOM_CODE`, `mockPath`). No live terminal patch reaches them. | `post-game/screen/display-result-screen.tsx`, `player-result-screen.tsx`, `host-result-screen.tsx` | **K5** |
| CC-06 | `host-game-screen` + `host-display-screen` are mock-only (`MOCK_ROOM_CODE`, `mockPath`, `gbedity.app/d/4ZK`). Not in the live navigate path, but reachable via `/preview-screens` and stranded if entered directly. | `in-game/screen/host-game-screen.tsx`, `onboarding/screen/host-display-screen.tsx` | — |
| CC-07 | Reveal/leaderboard/end-of-game live render is `LiveBoard` only (generic ranked rows from `board`/`ranked`). Under-tested against real terminal patches. | `in-game/live/live-renderers.tsx:228` | **K4** |
| CC-08 | Display QR hardcodes `http://localhost:5173/join/${code}` — breaks in any non-local environment. | `lobby/screen/display-lobby-screen.tsx:70` | — |

### Meemaw / JSX correctness (P3)

| ID | File | Violation |
|----|------|-----------|
| CC-10 | `preview/screen/parts/preview-sidebar.tsx:60` | `{filtered.length === 0 && (…)}` — raw `&&` in JSX (use `<Show>`). Preview-only screen. |
| CC-11 | `in-game/live/live-renderers.tsx:122,200`; `admin/.../metrics-screen.tsx:22,44`; `admin/.../content-screen.tsx:114` | `.map()` directly in JSX render (FSD prefers `<Repeat>`). Wired screens — low risk, but inconsistent with `catalogue-screen` which does use `<Repeat>`. |

### Clean (audited, no findings)

- **Color tokens:** no raw `bg-[#…]/text-[#…]/border-[#…]` in features. ✅
- **Icon proxy:** zero direct `from 'lucide-react'` imports — all via `@icons`. ✅
- **`console.log`:** none in `src`. ✅
- **`any`:** none in features. ✅
- **DOM queries:** only in `landing/.../roaming-monkeys.tsx` (an animation widget; acceptable). ✅
- **Mutations:** all `useMutation` callers pass `onError`/handle `ApiError`; `onSuccess` invalidation present on content/rubric. ✅
- **Zod at boundary:** all REST responses parsed (`CreateRoomResult`, `LobbySnapshot`, `JoinRoomResult`, `ServerView`, etc.). ✅
- **204 handling:** api-client returns early on 204 (no `.json()`). ✅

### Backend known-issues re-check (do NOT just re-log — confirm current state)

| ID | Handoff said | Live probe at plan time | Action |
|----|--------------|--------------------------|--------|
| K1 | Quizzes start → `422 content.questions ≥ 1` (deck unseeded) | **Quizzes started OK** (`{data:{instanceId}}`). Recent commit seeded content. | **Likely resolved — re-verify in browser; downgrade K1 if it starts.** |
| K2 | Solo start → `not_enough_players` (≥2 by design) | Confirmed min rule | Verify the client message is clear, not a blank crash. |
| K7 | `/join/:code` + `/display/:code` were 404, "fixed this pass" | Both routes now registered (`app.routes.tsx` diff confirms) | Verify QR/deep-link lands + pre-fills. |
| K9 | Admin needs seeded account | `seed` → `409 conflict` (one exists) | Admin login blocked without creds. |

---

## Phase RM — Room creation (host) · `/host/new` → `/host/room/:code`

**Files:** `onboarding/screen/host-start-screen.tsx`, `lobby/screen/host-lobby-screen.tsx`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| RM-01 | `/host/new` renders three modes | "Quick Play", "Create Game", "League Play" tiles visible | `agent-browser open http://localhost:5173/host/new` → `eval "document.body.innerText"` |
| RM-02 | Quick Play creates a real room | `POST /rooms` fires; lands on `/host/room/<CODE>`; **code is 6 chars, NOT `GBE-4ZK`** | HAR start → click "Quick Play" → `get url`; assert `/^[A-Z0-9]{6}$/`, screenshot |
| RM-03 | Host lobby shows live code + share affordance | `RoomCodeChip` shows the live code; "Open the shared screen →" link present | `eval "document.body.innerText"` |
| RM-04 | Host appears as first roster entry tagged host | first `PlayerPill` carries `(you · host)` | `eval` body text |
| RM-05 | Create Game also creates a room then catalogue path | lands on host lobby (same as Quick) carrying live code | `get url` |
| RM-06 | **Bug to verify (BUG-02):** League Play | Click "League Play" → lands on `/host/league/new`. Then "Start league" → **check the URL: does it become `…/GBE-4ZK/…`?** If yes = mock leak, FAIL. | click through; `get url` after "Start league"; grep for `GBE-4ZK` |
| RM-07 | Create-room error surfaces | with backend down, a danger toast "Could not open a room." appears (not a blank screen) | `network route "*/rooms" --abort` → click → check toast |
| RM-08 | Double-click guard | rapid double click on a mode doesn't create two rooms | HAR: count `POST /rooms` = 1 (`createRoom.isPending` guard) |

---

## Phase JN — Player join · `/join`, `/join/:code`, `/join/nickname`, `/join/qr`

**Files:** `onboarding/screen/join-code-screen.tsx`, `nickname-screen.tsx`, `qr-scan-screen.tsx`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| JN-01 | Code entry validates against live room | type live `$CODE` → `GET /rooms/:code` ok → routes to `/join/nickname?code=$CODE` | fill `RoomCodeInput`, click "Join room", `get url` |
| JN-02 | Bad code shows coded message | type `ZZZZZZ` → danger toast "Couldn't find that room…" (`room_not_found`), stays on page | `eval` toast text; `get url` unchanged |
| JN-03 | < 6 chars blocks + shakes | type `ABC` → inline "Six characters needed.", shake animation, no API call | HAR: 0 `GET /rooms`; check `Field` error text |
| JN-04 | Auto-uppercase + dash formatting | typing `abc123` shows `ABC-123`; dash stripped before API | `eval "document.querySelector('#join-code').value"` |
| JN-05 | **Deep link `/join/:code` pre-fills (K7)** | open `/join/$CODE` directly → code box pre-filled with formatted code | `agent-browser open .../join/$CODE` → `eval` input value |
| JN-06 | Nickname pre-fills a suggestion | `/join/nickname?code=$CODE` shows a non-empty suggested nickname | `eval` input value |
| JN-07 | Join creates a real player | submit nickname → `POST /rooms/:code/players` → routes to `/lobby/$CODE`; reconnect token stored | HAR `POST …/players` 2xx; `get url`; `eval "sessionStorage.getItem('gbedity:reconnectToken')"` not null |
| JN-08 | Nickname-taken inline error | join with a name already in the room → inline "That nickname's taken." (`nickname_taken`), no toast | seed P1="Dupe", join as "Dupe"; check `Field` error |
| JN-09 | Profanity filter (client) | a banned nickname → inline "Pick another nickname.", no API call | type a `BANNED_NICKNAMES` entry; HAR 0 join calls |
| JN-10 | Nickname with no code in URL | `/join/nickname` (no `?code`) → submit redirects to `/join` | `get url` |
| JN-11 | **Bug to verify (UX):** clearing nickname re-injects a suggestion | clear the field → it auto-fills a *new* suggestion instead of staying empty (can't blank it). Confirm this is the behaviour; flag as P3 UX. | clear input via native setter; `eval` value |
| JN-12 | QR mock scan | `/join/qr` → after ~2s "Found it" toast → routes to `/join/nickname` **(note: no `?code`)** → JN-10 redirect applies | open, wait, `get url` — confirm whether code is lost |

---

## Phase LB — Lobbies (live roster) · host / player / display

**Files:** `lobby/screen/host-lobby-screen.tsx`, `player-lobby-screen.tsx`, `display-lobby-screen.tsx`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| LB-01 | Player lobby shows live roster | `/lobby/$CODE` lists all joined players from `GET /rooms/:code` | `eval` body text vs seeded names |
| LB-02 | Roster updates as players join | open host lobby; join a new player in another session; new name appears (lobby poll `staleTime:2000`) | join via API, reload/wait, `eval` |
| LB-03 | Empty roster copy | room with 0 players → "Waiting for players to join…" (host) / "Joining…" (player) | fresh room, `eval` |
| LB-04 | "You" highlight | player lobby marks own pill `isYou` (matches stored `playerId`) | `eval` for the you-styled pill |
| LB-05 | Display lobby QR + code (landscape) | `/host/room/$CODE/display` shows QR + hero code + roster aside | `eval`, screenshot |
| LB-06 | **`/display/:code` canonical entry (K7)** | open `/display/$CODE` → renders display lobby with code + QR | `agent-browser open .../display/$CODE`, screenshot |
| LB-07 | **Bug to verify (CC-08):** QR URL | the QR encodes `http://localhost:5173/join/$CODE` (hardcoded host). Confirm; flag for non-local. | inspect `<QrCode url>` via source / DOM |
| LB-08 | Player socket connects | player lobby opens a socket, `JOIN` emitted, status → live | `agent-browser console` for socket; or watch reconnect text absent |
| LB-09 | Leave room confirm | "Leave room" → confirm drawer → "Leave" → routes to `/` | click, modal detect (`childElementCount`), confirm |
| LB-10 | Host boot-player drawer | host "Manage <name>" → destructive confirm "Boot player" → toast "<name> was removed." (**note: toast only — no live boot call wired**) | modal flow; HAR shows no boot endpoint (expected gap) |
| LB-11 | End session critical modal | host "End session" → type-`END` critical modal → confirm → routes to `/` | critical modal flow |

---

## Phase CFG — Catalogue & Configure · `/host/catalogue`, `/host/configure/:gameId`

**Files:** `catalogue/screen/catalogue-screen.tsx`, `configure/screen/configure-screen.tsx`, `shared/games/game-queue.ts`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| CFG-01 | Catalogue renders all tiles | "Pick a game" + 18 game tiles; category filters work (dim non-matching) | `eval`, click a `CategoryChip`, screenshot |
| CFG-02 | Code threads into catalogue | open via host lobby "Pick a game" → URL carries `?code=$CODE`; back-link returns to `/host/room/$CODE` | `get url` |
| CFG-03 | Tile → configure carries code | click a tile → `/host/configure/:gameId?code=$CODE` | `get url` |
| CFG-04 | Configure renders per-game groups + preview | config cards + live preview rail render for the chosen game | `eval`, screenshot |
| CFG-05 | "Add to room" queues + returns | click "Add to room" → toast "<game> added." → back on `/host/room/$CODE`; row appears in Games list | toast, `get url`, `eval` Games list |
| CFG-06 | Backed vs preview-only labelling | a mock game row shows "Preview only"; a backed game (wordshot/quizzes/word_bomb/hot_take/plead) does not | queue one of each; `eval` |
| CFG-07 | **Bug to verify (CC-04 / K3):** config has no effect | change a slider/stepper, Add to room, then Start → `POST /rooms/:code/start` body has **no `config`** (engine defaults only) | HAR the start `POST`; inspect body |
| CFG-08 | Queue persists across round-trip | add game, go to catalogue, come back — queue still shows it (sessionStorage `gbedity:queue:$CODE`) | `eval "sessionStorage"`; reload, `eval` list |
| CFG-09 | Remove from queue | trash a queued row → it disappears; "Pick a game" reverts when empty | click trash, `eval` |

---

## Phase ST — Starting a game (host) · `POST /rooms/:code/start`

**Files:** `lobby/screen/host-lobby-screen.tsx` (`startOne`), `display-lobby-screen.tsx` (`start`)

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| ST-01 | Start a backed game (wordshot) | queue+▶Start wordshot → `POST /rooms/:code/start` 2xx → host nav `go()` to `/d/$CODE/game?live=wordshot` | HAR; `get url` (display tab) |
| ST-02 | **Re-verify K1:** Start quizzes | with content seeded, quizzes **starts** (`{data:{instanceId}}`), not 422. If it 422s, confirm the client shows a clear coded message. | start quizzes; HAR status; `eval` any toast |
| ST-03 | **K2:** Start under min players (solo room) | a 1-player room → start → coded `not_enough_players` → clear danger toast, no crash | fresh room w/ 0 extra players; start; `eval` toast |
| ST-04 | Start while already running | start twice → 2nd → `game_already_running` coded toast | start, start again; `eval` |
| ST-05 | Display-lobby "Start game" (host on display) | display lobby "Start game" (host session present) defaults to **wordshot** → `POST /start` → display game | HAR body `gameId:"wordshot"`; `get url` |
| ST-06 | Display-lobby start without host session | no host in session → "Start game" just previews display game shell (no API call) | clear session; click; HAR 0 start calls |
| ST-07 | Start a mock game from queue | a preview-only game's ▶Start opens `/d/$CODE/game?game=<id>` (mock shell, no socket) | `get url`; confirm `?game=` not `?live=` |

---

## Phase LP — Live play (Socket.IO) · 5 backed games

**Files:** `in-game/screen/player-game-screen.tsx`, `display-game-screen.tsx`, `in-game/live/live-renderers.tsx`
Backed games: `wordshot`, `word_bomb`, `hot_take_court`, `plead_your_case`, `quizzes`.

**Driving rig:** Window A = host (`/host/room/$CODE`), Windows B & C = players (incognito, joined), Window D = display (`/d/$CODE/game?live=<game>`). Host ▶Start, then play from B/C, watch D.

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| LP-01 | **Bug to verify (BUG-01):** player reaches LIVE view | after host starts wordshot, player lobby auto-advances. **Check the player URL: is it `/p/$CODE/game?live=wordshot` or `/p/$CODE/game` (no live)?** If no `?live`, the player is on `MockPlayer` (static toggle) — FAIL, BUG-01. | player window: `get url` after start; `eval` for the Active/Waiting/Spectator `Segmented` (= mock) |
| LP-02 | Display renders live opening patch | D shows the wordshot letter + category from `server.view` (not "Setting up…") | `eval` display body; screenshot |
| LP-03 | Player can submit (live path only) | on `LivePlayer`, typing + Submit emits `client.action {type:'wordshot.submit'}` | HAR/socket frames; or `eval` input clears on submit |
| LP-04 | Quizzes display + answer lock | display shows Q + 4 options; player taps → "Answer locked in"; buttons disable | per-window `eval` |
| LP-05 | Word Bomb turn gating | only the bomb-holder sees "It's your turn — go!"; others see "Someone else has the bomb". | compare B vs C `eval` |
| LP-06 | Hot Take submit→vote phases | submission textarea then (phase `voting`) defence list to vote; own defence not double-counted | `eval` across phases |
| LP-07 | Plead Your Case scenario + submit | scenario charge/facts render; defence textarea submits `plead.submit` | `eval`, HAR socket |
| LP-08 | **K8:** Plead AI degrade | with placeholder `OPENAI_API_KEY`, verdict path → "evaluation failed" handled gracefully (no blank/crash) | reach verdict; `eval` |
| LP-09 | **Answer secrecy (PRD/§6.5)** | a player must NOT see another player's submission or the answer early; display must not leak it pre-reveal | inspect B's DOM during C's turn |
| LP-10 | **K4:** reveal → leaderboard → final | drive a full round to terminal; `LiveBoard` renders ranked rows (not blank); player sees "Round over — check the shared screen." | screenshot each phase; `eval` |
| LP-11 | Display/player/host agreement | same round, three surfaces agree on phase/round number | cross-`eval` |
| LP-12 | Player score header | `LivePlayer` header pill "You: N pts" reflects `patch.yourScore` | `eval` header |
| LP-13 | Reconnecting indicator | kill socket mid-game (`network route ws --abort` / offline) → "Reconnecting…" card, then recovers on restore | toggle network; `eval` |
| LP-14 | Patch parse resilience | malformed `server.view` (missing `phase`) is ignored (Zod `safeParse`), screen doesn't crash | inject via route mock if feasible; else source-confirm |

---

## Phase PG — Post-game results

**Files:** `post-game/screen/*`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| PG-01 | **Bug to verify (CC-05 / K5):** single-game result is mock | reach `/d/$CODE/result` or `/p/$CODE/result` after a real game → shows mock `LEADERBOARD` / "You came 3rd" / `MOCK_ROOM_CODE`, **not live final scores** | `eval` — confirm names/score are the static mock set |
| PG-02 | Display result chrome renders | celebration card + orange winner bar + ranked rows + Play again/Pick another/End | screenshot |
| PG-03 | Host result actions route | Play again / Pick another / Round detail / End session navigate (to mock paths — expected) | click each, `get url` |
| PG-04 | **League final is partly live (LeagueResult)** | `/d/$CODE/league-result` uses `GET /rooms/:code/league/standings` resolved against lobby names; falls back to mock when no league | run a league; `eval` names vs roster; or no-league → mock board |
| PG-05 | League standings empty/404 | no league running → `standings` 404 → mock `LEADERBOARD` shown (graceful) | open league-result on a non-league room |
| PG-06 | Round detail screen renders | `/host/room/$CODE/round/:n` renders without crash | open, `eval` |

---

## Phase RC — Recovery & error surfacing

**Files:** `shared/realtime/room-socket-provider.tsx`, `room-socket-context.tsx`, `shared/services/api-client.ts`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| RC-01 | Backend unreachable on join | `GET /rooms/:code` network fail → `network_error` → "Couldn't reach the room." toast, no crash | `network route "*/rooms*" --abort`; attempt join |
| RC-02 | **K6:** `server.room_suspended` | host-left → players see SUSPENDED status (not a hang) | emit/simulate; `eval` status copy |
| RC-03 | **K6:** `server.room_ended` | room ends → ENDED status, players shown final state | simulate; `eval` |
| RC-04 | Socket reconnect on refresh | refresh a player mid-game → socket re-joins with stored `reconnectToken`/`playerId`, re-renders | reload player; `eval`; HAR `JOIN` payload |
| RC-05 | **Multi-tab session bleed (§6.2)** | two players in the **same profile** → 2nd join clobbers 1st's `sessionStorage`; confirm **incognito isolation** keeps them distinct | same-profile two tabs → check `gbedity:playerId`; then repeat in two incognito sessions |
| RC-06 | Navigate away mid-game | leave player game then return → socket cleans up (provider unmount closes socket) + re-establishes | navigate, back; `console` for dangling sockets |
| RC-07 | Room full (cap 50) | join the 51st player → `room_full` coded message, no blank | (heavy seed) or source-confirm code mapping |
| RC-08 | Host-only action as non-host | non-host attempts start → `not_host` coded message | call start with wrong/empty `hostId` via UI path; `eval` |
| RC-09 | Error envelope mapping | each coded error (`room_not_found`, `nickname_taken`, `not_enough_players`, `game_already_running`) maps to a specific message, never a generic crash | drive each; `eval` |

---

## Phase AD — Admin (`http://localhost:5174`) — **BLOCKED on credentials (K9)**

**Files:** `admin/src/features/*`, `admin/src/shared/api/admin-api.ts`

| ID | Test | Expected | How to verify |
|----|------|----------|---------------|
| AD-01 | Login page renders | `/login` → email/password form + "Sign in" | `agent-browser open http://localhost:5174/login`, `eval` |
| AD-02 | Wrong creds inline error | bad login → `invalid_credentials` → inline "Wrong email or password." (no toast) | submit junk; `eval` `Field` error |
| AD-03 | Guard redirects unauth | open `/` while logged out → `Navigate to /login` | open `/`, `get url` |
| AD-04 | **Login success (BLOCKED)** | valid admin → tokens stored (access in-memory, refresh in `sessionStorage`) → routed to `/` shell | **needs seeded creds** — mark BLOCKED until provided |
| AD-05 | Content list per kind | quiz_deck/word/hot_take_prompt/plead_scenario → `GET /admin/content/:kind` lists; empty → "No … yet." | (post-login) `eval`, screenshot |
| AD-06 | Content create (paste JSON) | valid JSON → `POST` → "Saved." + list invalidates; invalid JSON → "That isn't valid JSON." | modal flow |
| AD-07 | Content delete confirm | trash → destructive confirm → `DELETE` → row gone | modal flow |
| AD-08 | Metrics + recent plays | `/` → byGame cards + recent game-plays; empty states render | `eval` |
| AD-09 | Rubric editor | `/rubric` → criteria sliders seeded from `GET /admin/rubric`; Save → `PUT` → "Rubric saved." | slider change, save, `eval` |
| AD-10 | Admin API states | each screen's loading / error / empty render (handoff: never assume loading works) | `network route` mock 5xx + empty; screenshot all three |

---

## Test Execution Order

1. **Pre-flight** (PF-01…06) — services up, seed a live room + 2 players.
2. **Source audit** confirmation (BUG-01…03, CC-*) — cheapest bugs first.
3. **Room creation** (RM) → **Join** (JN) → **Lobbies** (LB) — builds the data the rest needs.
4. **Catalogue/Configure** (CFG) → **Start** (ST).
5. **Live play** (LP) — the multi-window rig; the BUG-01 verdict gates LP-03+.
6. **Post-game** (PG).
7. **Recovery/errors** (RC) — last, since they break room state.
8. **Admin** (AD) — only if credentials arrive; else report BLOCKED.

> React Query state rule: for **every** wired list/detail (lobby, content, metrics, rubric, standings) test all four — **loading** (screenshot on navigate), **success** (wait for data), **error** (`network route` mock), **empty** (fresh room / unseeded kind). Don't assume the spinner clears.

---

## Screenshots Naming Convention

```
phase-screen-state.png
e.g. rm-host-lobby-live-code.png · lp-display-wordshot-opening.png ·
     lp-player-MOCK-leak.png (BUG-01 evidence) · pg-display-result-mock.png ·
     ad-content-empty.png
```

---

## Total Test Count

| Phase | Functional | Bug/known-gap probes | Total |
|-------|-----------|----------------------|-------|
| Pre-flight | 6 | 0 | 6 |
| Cross-cutting (source) | 0 | 3 critical + 6 gaps + 2 meemaw = 11 | 11 |
| RM Room | 6 | 2 | 8 |
| JN Join | 10 | 2 | 12 |
| LB Lobby | 9 | 2 | 11 |
| CFG Catalogue/Configure | 6 | 3 | 9 |
| ST Start | 5 | 2 | 7 |
| LP Live play | 10 | 4 | 14 |
| PG Post-game | 4 | 2 | 6 |
| RC Recovery/errors | 7 | 2 | 9 |
| AD Admin (blocked) | 9 | 1 | 10 |
| **Total** | **72** | **31** | **103** |

---

## Priority Watch-List (what sign-off hinges on)

1. **BUG-01 (P1)** — players land on the mock game, not the live one. If confirmed, **no player can actually play any backed game live**. This is the single highest-impact finding and gates the entire LP phase.
2. **BUG-02 (P1)** — League Play entry point is a mock dead-end that leaks `GBE-4ZK`.
3. **K5 / CC-05 (P1-ish)** — single-game result shows fabricated scores after a real game; players see wrong outcomes.
4. **BUG-03 / CC-08** — mock-code & hardcoded-localhost leaks (P2).
5. **K4 (P2)** — reveal/leaderboard/final live render largely unverified.
6. **K9** — admin phase blocked until credentials are supplied.
