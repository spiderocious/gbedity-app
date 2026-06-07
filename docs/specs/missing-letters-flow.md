# Spec — Missing Letters: full animated flow rebuild (+ the gameplay bugs it fixes)

**Status:** spec · awaiting goal (no code yet) · fullstack (BE host-actions fix + FE flow rebuild)
**Scope:** rebuild the Missing Letters end-to-end play flow — intro → countdown → rounds → reveal →
results — with real transitions, animation, sound, and a working host "End game". Pattern modeled on
wordmaster (countdown / round-start interstitials) but with our design system + our **pure
state-machine backend** (no copy). Missing Letters is the template; other games follow after.

---

## 1. Root-cause diagnosis (why nothing worked — from source + your logs)

| # | Bug (what you saw) | Root cause (verified in source) |
|---|---|---|
| **A** | Question never appears; player stuck "Waiting for your turn…", host stuck "Starting the round…" | **No `missing_letters` live renderer.** `RENDERERS` (live-renderers.tsx) only has 5 games — not Missing Letters. `getLiveRenderer('missing_letters')` → undefined → the player falls through to the "Waiting for your turn…" fallback, the host to "Starting the round…". The game *is* running on the backend (timers fire, rounds advance) — the client just has no UI for it. |
| **B** | Patch never even identifies the game | **`detectLiveGame` has no Missing Letters case.** Its patch (`{phase, idx, masked, length, ...}`) matches none of the 5 shape-checks → returns undefined. The `?live=` hint also isn't passed reliably from the host-game start. |
| **C** | Host "End game" does nothing; everyone stuck on "That's a wrap" forever | **`host.end_game` is not a real action.** The host emits `{type:'host.end_game'}`, but the plugin's `actionSchema` only accepts `missing_letters.guess` → the runtime throws → your exact log: `action dispatch rejected … expected "missing_letters.guess"`. There is **no host-control action path** in the engine at all. (Same class as the `host.skip` button — also dead.) |
| **D** | "Round over" / "That's a wrap" with no questions between | Consequence of A+B: the only patches the client *can* render are the phase-only interstitials (`reveal`→"Round over", `done`→"That's a wrap"). The actual `round` phase has no renderer, so you only ever see the gaps. |
| **E** | "single dot on top '.'" the player sometimes sees | The Missing Letters `masked` string for a 1-letter reveal renders as `_` / a lone char — there's no real renderer, so it's the raw masked value leaking through a generic fallback. |
| **F** | No sound, no animation | The in-game screens use none of `useSound`/`soundService` (they exist in `@gbedity/ui`), and there are zero transitions — screens hard-swap on phase. |

**So the minimum to make Missing Letters *work* is A+B+C. The rest of this spec is the *experience*
rebuild (D/E/F) on top of that.**

---

## 2. Backend changes (small, pattern-matching — the engine already supports this)

The engine is a pure state machine; host controls must become **real actions** the plugin handles
(the `ActorRole.HOST` is already passed to `dispatchAction` and token-verified — it's just unused).

1. **Engine: a shared host-control action contract.** Add named system actions alongside
   `SystemActionType` (constants.ts): `HOST_END_GAME = 'host.end_game'`, `HOST_SKIP = 'host.skip'`.
   The runtime's `dispatchAction(actor, role, action)` already has the role — intercept host-control
   actions **before** plugin `actionSchema.parse` (so they're engine-level, not per-game) and only
   honor them when `role === HOST`:
   - `host.end_game` → drive the active game to end: call a new `runtime.endGame()` that emits
     `GAME_ENDED` (→ session `onEnded` → room back to lobby, exactly like a natural finish). One
     place, every game gets working End-game + Skip for free.
   - `host.skip` → fire the current timer's `onTick` early (advance the phase). Reuses existing
     tick logic; no per-game code.
   This fixes **C** generically and matches the existing effect/runtime patterns (no plugin edits).
2. **Missing Letters content seeding.** Confirm `installMissingLettersContent` seeds enough words
   (≥ `rounds`) so a real game has content; the start path already 422s on bad content. (Verify, not
   assume — your run started, so content exists; just confirm word count vs default `rounds: 8`.)
3. **No new phases on the backend.** Per the wordmaster pattern (confirmed: interstitials are
   *frontend-driven*), the countdown / "get ready" / round-start cards are **client constructs**. The
   backend keeps its `round | reveal | done` phases + absolute-deadline timers. The client
   choreographs the interstitials *around* those phases. The one piece of backend timing the client
   needs is the round `deadline` (already in state) — **expose `deadline` (epoch-ms) and
   `secondsPerRound` in the `view()` patch** so the client can render a real countdown timer and a
   pre-round "get ready" beat. Tiny `view()` addition, no logic change.
4. **Scores in the patch (for ⑤b Round Scores + all-audience scores).** The Missing Letters `view()`
   must include, at `reveal`, the **round board** — every player's running total + this round's
   delta — as `board: [{ playerId, points, roundDelta }]` (names resolved client-side from the lobby
   roster, as `LiveBoard` already does). Today the plugin reports deltas via `scoreRound`/`ROUND_ENDED`
   to the session leaderboard, but doesn't surface running totals in `view()`. Two clean options
   (pick in §6): (a) the plugin tracks a cumulative `scored` map in its own State and projects it
   (it already keeps `solved` per round — extend to a cumulative tally); or (b) the runtime threads
   the session leaderboard into `ViewCtx` so any game's `view()` can read totals. *(Recommend (a)
   for this slice — self-contained in the plugin, no engine change; revisit (b) when a 2nd game needs
   it.)* This is what makes "all scores show for everyone, incl. spectators" real.
5. **Spectator model** — see §3.3.1 (RoomPlayer.spectator, join flag, reserved nickname, roster/min
   exclusion, display-projection routing). Small, modeled properly; closes the QA "spectators not
   modeled" gap.

---

## 3. Frontend rebuild — Missing Letters flow (per-game, not dynamic)

Per your direction: **explicit per-game flows, not one dynamic renderer.** Missing Letters gets its
own flow module: `features/in-game/games/missing-letters/`. A small per-game flow state machine sits
*on top of* the backend patch and owns the interstitials.

### 3.1 The player's screen sequence (the thing that was missing)
```
START (host clicks Start in lobby)
  │
  ▼
① GAME INTRO            "Missing Letters" — rules one-liner + config chips (rounds, seconds)
   (client, ~2.5s)       brand card, GameId numeral, category tint; Confetti-lite entrance
  │  → countdown
  ▼
② GET READY countdown   3 · 2 · 1 · GO  (client) — Fraunces numerals, spring scale, color shift
  │  (first backend `round` patch is already live underneath)
  ▼
③ ROUND n of N          "Round 1" interstitial (client, ~1.2s) — round numeral, progress dots
  │
  ▼
④ THE WORD (round)      the masked word "B _ N _ N _" big (Fraunces), per-letter slot tiles,
   (backend `round`)     a live countdown ring from `deadline`, the answer input, submit.
                         On correct → green flash + success sound + "Locked in" (solved state).
                         On wrong → tomato shake + error sound (silent retry, as backend does).
  │  (backend timer fires → reveal)
  ▼
⑤ REVEAL                the full answer revealed letter-by-letter; who solved + points;
   (backend `reveal`)    success chime. ~revealSeconds (from patch).
  │  → loops to ③ for next round, or ⑥ if done
  ▼
⑤b ROUND SCORES         every player's running score + this round's deltas (client interstitial,
   (client, ~3s)         ~3s) — ranked rows, the round winner highlighted. Shown for ALL audiences,
                         INCLUDING spectators. Sits between letter-reveal and the next round.
  │  → loops to ③ for next round, or ⑥ if done
  ▼
⑥ THAT'S A WRAP         final card; "full standings on the shared screen"; play-again/exit.
   (backend `done`)
```
- **②③⑤b are interstitials between backend states** (wordmaster pattern). The backend is already in
  `round` when the countdown plays — the client just *holds* the reveal of the word until GO, then
  shows the live word. Safe because the deadline is absolute. The **Round Scores** beat (⑤b) plays
  during the backend's `reveal` window (its `revealSeconds`) — the reveal patch already carries the
  scored board (`ROUND_ENDED` → `scoreRound` deltas applied), so ⑤a (letter reveal) and ⑤b (scores)
  are two client stages over the one backend `reveal` phase. The client needs the per-round board in
  the patch — see §2.4.

### 3.2 Per-game flow state machine (client)
A `useMissingLettersFlow(patch)` hook maps `(backendPhase, roundIndex)` → a client `FlowStage`:
`intro → countdown → round_start → playing → reveal → round_scores → done`. Transitions:
- mount → `intro` → (timer) → `countdown` → (timer) → `round_start` → (timer) → `playing`
- backend `phase==='round'` with a NEW `idx` → `round_start` (brief) → `playing`
- backend `phase==='reveal'` → `reveal` (letter-by-letter) → (timer, ~half of revealSeconds) →
  `round_scores`
- backend `phase==='done'` → `done`
Each non-backend stage owns its own short timer (the wordmaster `useCountdown` pattern). Reduced-
motion collapses interstitials to instant. The stage machine is **identical for player / host /
spectator** — only the per-stage *rendering* differs by audience (§3.3).

### 3.3 Three audiences (same flow machine, audience-specific rendering)
- **Player:** the full input flow (④ interactive). Sees all players' scores at ⑤b.
- **Host:** plays off the PLAYER projection (host is a seat) — sees ④ as a player AND a host-control
  strip (Skip / End game) that now actually works (§2.1). Sees all scores.
- **Spectator (= the new "display"):** sees the **entire flow as if playing** — intro → countdown →
  round → the word → reveal → round scores → wrap — but **never an input**, and never an answer
  before reveal. Shows all players' scores throughout. **No buttons** (no start/config/host
  controls) — it is a participant-shaped observer, not a control surface. Big/read-only styling for
  the shared screen, but the SAME stage sequence as players (your ask: "shows the entire flow… as if
  it's playing, just no scores of its own / no input"). The spectator renders from the **display
  audience** projection (answer-secret server-side).

### 3.3.1 Spectator model (the reframed "display") — backend + frontend

**Backend (small, modeled properly — closes the QA "spectators not modeled" gap):**
- `RoomPlayer` gains `spectator: boolean` (default false). One field.
- **Join as spectator:** `POST /rooms/:code/players` accepts `{ nickname, spectator?: boolean }`.
  A spectator is a real seat (so it gets a reconnect token + a WS player connection + per-player
  views) but flagged. Service sets `spectator: true`.
- **Reserved word:** nickname validation rejects any nickname containing "spectator"
  (case-insensitive) → `422 validation_error` + `field_errors.nickname` (a new
  `MESSAGE_KEYS.rooms.NICKNAME_RESERVED`). The "(SPECTATOR)" suffix is **server-applied** to the
  stored/returned nickname so it can't be spoofed and shows everywhere (lobby roster, scores).
- **Roster + min-count exclusion:** `startGame` builds the plugin roster from
  `room.players.filter(p => !p.spectator)` and the min-player check counts **non-spectators only**.
  This is the core fix: spectators never enter the plugin, never get a turn, never count toward min.
  (PRD §4/§10.)
- **Views:** a spectator seat receives the **display projection** (answer-secret), not the player
  projection — so it can't see answers early and has no input affordance server-side. The gateway
  routes a `spectator` seat to the display channel.
- **WS join role:** spectators join as `role: player` with their token (real seat) but the gateway
  subscribes them to the display channel based on the `spectator` flag (not a new role) — minimal
  protocol change, reuses the seat/reconnect machinery.

**Frontend:**
- **Lobby opt-in (players only):** in the player lobby, above "Leave room", a **"Spectate this game"**
  checkbox → confirm `Modal` ("You won't be able to play this round — you'll watch and see everyone's
  scores. Continue?"). On accept → re-join (or flag) as spectator; the roster shows `name (SPECTATOR)`.
- **Nickname screen:** reject "spectator" substring inline (the backend also enforces it — client is
  UX only, server is the control, per the seam rule).
- **The display URL** opens a spectator client directly (the shared-screen path) — same spectator
  rendering, just opened on the TV. So "display" and "a player who chose to spectate" are the same
  client, different entry.
- **Spectator lobby:** shows code, QR, the live lineup, and the players list — but **no host/start/
  config buttons** (read-only). It auto-advances into the spectator game flow when the game starts
  (it already holds a socket).

### 3.4 Fix A/B directly
- Add `missing_letters` to `detectLiveGame` (match on `masked !== undefined || idx !== undefined`),
  and register a Missing Letters renderer (its own module) so the generic `LivePlayer`/`LiveBoard`
  path resolves it. But the richer path is the dedicated flow (§3.1) — the generic renderer is the
  fallback; the flow module is what the in-game screens route to for Missing Letters.

### 3.5 Animation + sound (D/E/F)
- **Animation:** GSAP (already a dep, already used on the landing) — a small set of reusable flow
  primitives in `features/in-game/flow/`: `CountdownNumerals`, `StageTransition` (cross-fade/scale
  between stages via a keyed wrapper), `LetterSlots` (per-letter reveal), `CountdownRing` (timer).
  All reduced-motion gated. NOT in `@gbedity/ui` (in-game-specific) until a 2nd game reuses them.
- **Sound:** wire `useSound()` (already in the lib): `GAME_START` on intro, `BUTTON_CLICK` on
  submit, `SUCCESS` on correct + reveal, `ERROR` on wrong. The `<SoundButton>` mute toggle already
  exists app-wide. (5 sound keys exist; we may add `countdown_tick` / `round_win` to the manifest —
  one-line additions if we want them.)

---

## 4. Files

**Backend**
- `engine/constants.ts` — add `HostActionType` (`HOST_END_GAME`, `HOST_SKIP`) constants.
- `engine/game-runtime.ts` — host-control intercept in `dispatchAction` (role-gated) → `endGame()` /
  early-tick; small additions, reuses existing effect/tick machinery.
- `engine/room/room.types.ts` — `RoomPlayer.spectator: boolean`.
- `engine/room/room-registry.ts` — `addPlayer(..., spectator)`; nickname reserved-word + suffix.
- `features/rooms/rooms.service.ts` — join accepts `spectator`; reserved-nickname check; `startGame`
  roster + min-count from non-spectators only.
- `features/rooms/rooms.controller.ts` — pass `spectator` through; lobby roster includes the flag.
- `shared/messages/keys.ts` + `index.ts` — `rooms.NICKNAME_RESERVED`.
- `engine/gateway/index.ts` — route a `spectator` seat to the display channel (not the player one).
- `games/missing-letters/missing-letters.plugin.ts` — `view()` adds `deadline`, `secondsPerRound`,
  and the cumulative `board` (running totals + round delta) at reveal; State gains a cumulative tally.

**Frontend**
- `features/in-game/games/missing-letters/` — `missing-letters-flow.tsx` (the §3.1 sequence incl.
  ⑤b Round Scores, 3 audience renderings), `use-missing-letters-flow.ts` (the §3.2 stage machine).
- `features/in-game/flow/` — reusable interstitial primitives (`CountdownNumerals`,
  `StageTransition`, `LetterSlots`, `CountdownRing`, `RoundScores`).
- `features/in-game/resolve-live-game.ts` — add Missing Letters detection + `LiveGameId`.
- `features/in-game/live/live-renderers.tsx` — register the Missing Letters fallback renderer.
- `features/in-game/screen/{host,player,display}-game-screen.tsx` — route Missing Letters to its
  flow module; fix host End-game/Skip to emit the real `HostActionType` constants; the display screen
  becomes the spectator flow (read-only, no buttons).
- `shared/types/api.ts` — `LobbyPlayer` gains `spectator`; join hook + lobby snapshot carry it.
- `shared/api/use-join-room.ts` — accept `spectator`; `features/lobby/screen/player-lobby-screen.tsx`
  — "Spectate this game" checkbox + confirm modal; `features/onboarding/.../nickname` — reserved-word
  client check. Spectators excluded from the lobby player count / start gating in the UI too.
- (Sound) wire `useSound` at the flow transitions.

---

## 5. The pattern this establishes (so other games are fast)
- **Backend stays a pure state machine.** Host controls become engine-level role-gated actions (one
  fix, all games). Interstitials are frontend-driven (wordmaster-confirmed).
- **Each game owns an explicit flow module** (`games/<game>/`) composing shared flow primitives
  (`flow/`). Not a dynamic mega-renderer — per your call. Adding a game = a new flow module + a
  detection case + a renderer, reusing the primitives.
- **Three audiences, one flow** (player interactive / display big / host plays+controls).

---

## 6. Decisions (locked with the owner)
1. **Interstitials EVERY round** (intro+countdown at start; "Round n" + the word + reveal + round
   scores each round). ✅
2. **Host controls = engine-level** role-gated actions (one fix, all games). ✅
3. **GSAP** (no new dep). ✅
4. **All three audiences** — player + host + spectator. **The "display" is reframed as a SPECTATOR**
   (§3.3/§3.3.1): no buttons, participant-shaped observer, sees the whole flow + all scores, never
   an input/answer. Players can also opt to spectate from the lobby. ✅
5. **Round Scores screen (⑤b)** between letter-reveal and next round, all audiences. ✅
6. **Sound:** add `countdown_tick` + `round_win` to the manifest (+ reuse the existing 5). ✅

## 7. Done when
- Missing Letters plays start→finish for **player, host, and spectator**: intro → countdown → Round n
  → word shows → type/submit → correct/wrong feedback → letter reveal → **round scores (all players)**
  → next round → wrap.
- **Spectator:** joins via display URL OR a player opting in from the lobby; name shows `(SPECTATOR)`;
  never gets an input; doesn't count toward min-players; sees all scores; "spectator" is a reserved
  nickname (server-enforced).
- Host **End game** actually ends it (room → lobby); **Skip** advances; no `action dispatch rejected`.
- Transitions animated (reduced-motion safe); sound on the key beats.
- Typecheck ✅ · lint ✅ · tests ✅ (engine host-action test + spectator roster/min test + a
  flow-stage test).
- Bugs A–F verifiably closed.
