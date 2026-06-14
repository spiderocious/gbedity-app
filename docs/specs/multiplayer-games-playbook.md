# Multiplayer Games Playbook — building a game's multiplayer experience end to end

> **Companion to `solo-games-playbook.md`.** Read **both** before building a game. The solo playbook
> covers the mission, rules, design language, and the client-driven solo path. This one covers the
> **multiplayer** path: how a game runs through the existing room / league / WebSocket engine, and how
> to give it a **new self-contained design slice** without rebuilding the infrastructure.
>
> **The full lifecycle for a new game is:**
> **research → backend → build preview UI → WAIT FOR USER APPROVAL → build solo frontend logic →
> build multiplayer (backend + frontend changes when/if needed).**
> Do them in that order. Don't skip the approval gate. Don't skip research.

---

## 0. ⚠️ RESEARCH FIRST — this is not optional

**Before writing a single line for any game, you MUST research the actual source.** Documentation
drifts; source does not lie. The cost of guessing here is days of debugging a desynced socket flow.

Concretely, for the game you're building, **read and cite (path:line)**:

1. **The backend plugin** `apps/backend/src/games/<game>/<game>.plugin.ts` — the *authoritative* source
   for: the phase enum, the exact action shape (**field names matter** — Missing Letters' guess is
   `{type:'missing_letters.guess', text}`, the field is `text` not `value`), the config schema, the
   content schema, the scoring rule, and **exactly what `view(state, audience)` exposes for PLAYER vs
   HOST vs DISPLAY**. The player patch usually carries private fields (`locked`, `solved`,
   `yourScore`) the others don't.
2. **The content resolver** `<game>.content.ts` — what content shape the engine resolves server-side.
3. **The engine contract** — `engine/types.ts` (GamePlugin, Effect, ViewPatch), `engine/game-runtime.ts`
   (how effects → timers → broadcasts), `engine/gateway/{index,protocol}.ts` (the socket contract:
   event names, join payload, channels per audience, action dispatch, lifecycle events).
4. **How a game starts** — `features/rooms/rooms.service.ts` `startGame`, and `features/league/
   league.service.ts` for league.
5. **The existing frontend flow for this game** (if one exists in the OLD system) —
   `features/in-game/games/<game>/*` — so your new design is **feature-complete** (don't regress
   intro/countdown/presence/lock/reveal/scores/sounds).
6. **The frontend socket infra** you'll reuse as-is — `shared/realtime/room-socket-provider.tsx`,
   `room-socket-context.tsx`, `shared/services/socket.ts`, `shared/types/view.ts`.

**Use parallel sub-agents (Explore / general-purpose) to do this research and return dense,
path:line-cited traces.** Then build against the trace, not against memory. The two existing playbooks
were written from exactly such traces.

---

## 1. The mental model: solo vs multiplayer are different machines

| | **Solo** (client-driven) | **Multiplayer** (engine-driven) |
|---|---|---|
| Transport | REST (`/api/v1/solo/<game>/*`) | WebSocket (Socket.IO) via the engine gateway |
| Who paces the game | **the client** (own countdown, "request next round") | **the backend** (`GameRuntime` timers; phases auto-advance) |
| Client's job | run the flow, call endpoints | **render a projection of `ViewPatch`**; send actions |
| State | in-memory session keyed by `soloId` | room + `SingleSession`/`LeagueSession` + plugin state |
| Why | one device, no sync needed | many devices MUST stay synchronized |

**The hard rule:** in multiplayer the client **cannot drive pacing**. It receives `server.view`
patches and renders whatever phase the patch says, computing any countdown from the patch's absolute
`deadline` (epoch-ms) so every device is in lockstep. It only *sends* one thing: the game action
(e.g. a guess). The host additionally can send engine control actions (skip / end-game / end-session).

**What's shared between solo and MP:** the **`ui/` atoms and `screens/`** of your game slice (built
and approved during the solo phase), and the backend's **pure** logic (masking, word-picking — lifted
into a shared module). What's NOT shared: the *driver*. Solo has a client state machine; MP has a
patch-reactive container. That's fine and expected — keep them separate.

---

## 2. What you reuse AS-IS (do not touch)

The entire room/league/socket infrastructure is **game-agnostic**. Reuse it untouched:

- **Socket layer** — `shared/services/socket.ts` (`ClientEvent.{JOIN,ACTION}`,
  `ServerEvent.{JOINED,VIEW,ERROR,ROOM_SUSPENDED,ROOM_ENDED,RESUMED,GAME_OVER}`,
  `SocketRole.{HOST,PLAYER,DISPLAY}`, `HostAction.{END_SESSION,END_GAME,SKIP}`, `JoinPayload`).
- **`RoomSocketProvider` + `useRoomSocket()`** (`shared/realtime/*`) — owns the one socket, joins on
  mount, Zod-parses `server.view`, **stores patches per audience** (`patches[Audience.PLAYER|HOST|
  DISPLAY]`), exposes `{status, patches, patch, gameOver, errorCode, sendAction, endSession}`. On
  `GAME_OVER` it stashes the final board to `resultStore` and sets `gameOver`. On `ROOM_ENDED` it
  shows the closed screen. **This is your whole transport — you write none of it.**
- **`shared/types/view.ts`** — `ViewPatch` (one permissive `.passthrough()` Zod schema with every
  game's fields, incl. all Missing Letters fields), `Audience`, `Phase`.
- **Entry + lobby + league** — landing → `/play/:gameId` → Multiplayer → create room
  (`host-start-screen` → `useCreateRoom`) or join (`join-code-screen`) → **lobby**
  (`features/lobby/screen/*`). The host starts via `useStartGame` (`POST /rooms/:code/start`) or
  `useStartLeague`; players/display **auto-advance** from lobby into the game route when the first
  non-LOBBY patch arrives over their already-open lobby socket. Spectate, lineup, roster — all reused.
- **Routes** — `PLAYER_GAME /p/:code/game`, `DISPLAY_GAME /d/:code/game`, `HOST_GAME
  /host/room/:code/game`, the `*_RESULT` routes. `pathWith(ROUTES.X, {code})` + `?live=<backendId>`
  hint. **No new routes needed** (with the integration approach below).
- **`session-store`** (identity + reconnect tokens), **`result-store`** (final board), **`HostControlStrip`** + `host-controls.ts` (generic skip/end-game).

---

## 3. The integration seam (the ONLY change to shared code)

The three generic game screens — `features/in-game/screen/{player,display,host}-game-screen.tsx` —
already latch the live backend gameId (`useLatchedLiveGame`/`detectLiveGame`). **Branch there:**

```tsx
// inside LivePlayer / LiveDisplay / LiveHost, after backendId is resolved:
if (backendId === 'missing_letters') {
  return <MpMissingLetters audience="player" /* | "spectator" | "host" */ code={code} />;
}
// ...else fall through to the old getGameFlow(...) path (every other game, untouched)
```

This is **option (b)**: one `if` per screen. No new routes, no lobby/nav changes, no risk to the 17
other games or the league/result flow. Your new slice consumes `useRoomSocket()` (already provided by
the screen's `RoomSocketProvider`) and renders the new design. When all games are migrated, the old
`flow-registry` / `use-game-flow` / `detectLiveGame` / generic-flow system gets deleted in one sweep.

> Per-screen audience: player screen → `audience="player"`, display → `"spectator"`, host →
> `"host"`. The host seat plays off the **PLAYER-audience** patch (`patches[Audience.PLAYER]`) —
> NOT the convenience `patch` — because the host also receives a host-audience patch; read the
> player projection for gameplay and layer host controls on top.

---

## 4. The multiplayer slice anatomy

Under your existing game slice, add a `multiplayer/` folder (reuses `ui/` + `screens/`):

```
features/games/<game>/
├── ui/                       # SHARED atoms (built in solo phase) — reused
├── screens/                  # SHARED screens (built in solo phase) — reused
├── solo/                     # client-driven solo (built in solo phase)
└── multiplayer/              # NEW — engine-driven
    ├── logic/
    │   ├── patch.ts          # narrow the permissive ViewPatch → a typed, game-specific view-model
    │   ├── phase.ts          # map backend phase → which screen to show (POJO, no inline unions)
    │   └── use-mp-<game>.ts  # reads useRoomSocket(); per-audience derives the view-model; exposes
    │                         #   submit(action) → sendAction({type:'<game>.<action>', ...})
    └── screens/
        └── mp-screen.tsx     # audience-aware container: maps the live patch → the SHARED screens,
                              #   wires submit + (host) the HostControlStrip
```

Principles:
- **`use-mp-<game>.ts` is the only new stateful piece.** It does NOT own a timer-driven phase machine
  (the backend does). It reads `patches` from `useRoomSocket()`, picks the right audience patch,
  parses it (`patch.ts`), and returns a clean view-model: `{phase, maskedOrPrompt, deadline,
  rounds, idx, board, locked, yourScore, answer?}` plus `submit(text)` and host controls.
- **Countdowns compute from `patch.deadline`** (absolute epoch-ms), via a small `useDeadline(deadline)`
  hook that ticks `secondsLeft = (deadline - Date.now())/1000`. NEVER run an independent client clock
  for round timing — it desyncs across devices.
- **`locked` / `solved` / `yourScore` come from the patch**, not local state. After you `submit`, the
  backend sends a private `TO_PLAYER` patch with `locked:true`.
- **The shared screens may need small additive props** to serve MP, e.g. the per-round scores screen
  in MP has NO player-controlled "Continue" (the engine times reveal→next), so pass a prop like
  `actions={false}` / `autoAdvance` rather than forking the screen. Keep screens pure; branch via
  props, never duplicate.

### Audience behaviours (the "different screens, shared logic + UI" requirement)
- **player** — interactive: intro → countdown (off `deadline`) → question (type, submit, one-shot
  lock) → reveal/scores (timed) → final.
- **spectator (display/TV)** — same screens, **read-only** (no input; "Players are racing…"), sized
  for the room; holds the final board (the hands-free display loop — the provider un-latches
  `gameOver` when the next game's first live patch arrives).
- **host** — plays off the player projection **plus** `HostControlStrip` (Skip → `HostAction.SKIP`,
  End game → `HostAction.END_GAME`) via `sendAction`.

---

## 5. The socket contract you implement against

(Verify against `engine/gateway/{index,protocol}.ts` + your plugin — don't trust this table blindly.)

- **Join** is done by `RoomSocketProvider` (you don't call it): emits `client.join {roomCode, role,
  reconnectToken?, playerId?}`; you receive `server.joined`, then `server.view {audience, patch}`.
- **Send an action:** `sendAction({ type: '<game>.<action>', ...fields })` →
  `client.action {action}`. Accepted only in the right phase; one submission per round; wrong/dup/
  out-of-phase are silent no-ops; a malformed shape yields `server.error {invalid_action}`.
- **Host controls:** `sendAction({type:'host.skip'})`, `{type:'host.end_game'}`,
  `endSession()` (→ `host.end_session`). Honored only for the token-verified host.
- **Patch sequence (typical):** `countdown` (with `deadline`) → `round` (masked/prompt + `deadline`)
  → private `TO_PLAYER` on submit (`locked:true`) → `reveal` (`answer` + `board` with `roundDelta`)
  → repeat → final `reveal` → `done` patch + room-wide `server.game_over`. `gameOver` from
  `useRoomSocket()` drives navigation to the result screen (player/host) or the hold-the-board loop
  (display).

---

## 6. Backend changes for multiplayer — usually NONE

The multiplayer engine path for your game **already exists** (the plugin + runtime + gateway). In the
common case you write **zero backend code** for MP — you build a frontend that speaks the existing
socket contract. Only touch the backend if research reveals a genuine gap, e.g.:

- A missing field the new design needs in `view()` — add it to the plugin's `view()` (guard against
  throwing; `view` runs during recovery).
- A scoring/secrecy bug.
- **League sequencing** (known gap as of this writing): `LeagueSession` starts the first game but does
  not auto-start the next on game-end (no league-level `onEnded`/advance). So *single-game* MP works;
  *league* MP plays game 1 then stalls. Fix `engine/session/league-session.ts` (advance to
  `startNext()` on `finishCurrent`, or add a league `onEnded` → room-back-to-lobby) when you tackle
  league — it benefits **all** games. Build + verify **single-game MP first**.

When you DO change the backend, obey the same rules as the solo playbook (`ServiceResult`,
`ResponseUtil`, message keys, no `req` in services, `asyncHandler`, no `any`) and add/adjust the
plugin's Jest test.

---

## 7. Step-by-step (multiplayer phase, after solo is approved + built)

1. **Research** (§0) — re-confirm the player/host/display patch fields and the action shape from the
   plugin source; read the old flow for feature parity.
2. **`multiplayer/logic/`** — `patch.ts` (narrow ViewPatch → typed view-model), `phase.ts` (backend
   phase → screen), `use-mp-<game>.ts` (the patch-reactive driver + `submit` + host controls +
   `useDeadline`). Typecheck.
3. **`multiplayer/screens/mp-screen.tsx`** — audience-aware container mapping the view-model to the
   shared screens. Add any additive props the screens need for MP (e.g. `actions={false}`). Typecheck
   + lint.
4. **The seam** — add the `if (backendId === '<game>') return <Mp<Game> audience=… code=… />` branch in
   the three generic game screens. (Player → "player", display → "spectator", host → "host".) Nothing
   else in shared code changes.
5. **Backend** — only if §6 says so. Typecheck + Jest.
6. **End-to-end, live** — `nx dev backend` + `nx dev game`. Open the host on one browser, a player on
   another (and a display). Create a room, start the game, play a full match: verify synced
   countdown, masked word, submit + lock, reveal, round scores, final board + `game_over` nav, host
   skip/end-game. Multi-tab/multi-device is the real test — a single tab can't prove sync.
7. **Update memory + the docs** if you found a new pattern or a backend gap.

---

## 8. Gotchas (multiplayer-specific; also read the solo playbook's §8)

- **Never run a client clock for round timing.** Compute `secondsLeft` from `patch.deadline`. An
  independent timer desyncs devices and races the first round patch.
- **The host seat is also a player.** Read `patches[Audience.PLAYER]` for gameplay on the host
  screen, not the convenience `patch` (which may resolve to a host-audience patch).
- **`locked`/`solved`/`yourScore` are player-only patch fields.** Spectator/host base patches don't
  carry them — guard with `?? false` / `?? 0`.
- **One submission per round, server-enforced.** Wrong/duplicate/out-of-phase guesses are silent
  no-ops; don't expect an error. Drive lock state off the returned patch.
- **`answer` appears only at `reveal`** (secrecy). Don't try to read it during `round`.
- **Display never navigates on `gameOver`** — it holds the final board (hands-free loop); the next
  game's first live patch un-latches it (the provider clears `gameOver` on a live-phase patch).
- **Spectators** (over the game cap) are routed to the display channel; a player flagged spectator in
  the lobby is redirected to the display game route.
- **League stalls after game 1** today (§6) — don't be surprised; it's a known backend gap.
- **Multi-tab testing:** browsers share `sessionStorage` per-tab but the socket is per-connection;
  use separate browsers/profiles or incognito for host vs player vs display to avoid identity
  collisions.

---

## 9. Reference index (Missing Letters)

**Backend (engine path):** plugin `apps/backend/src/games/missing-letters/missing-letters.plugin.ts`
(authoritative patch + action + phases + scoring); resolver `…/missing-letters.content.ts`; mask
`…/missing-letters.mask.ts`; gateway `engine/gateway/{index,protocol}.ts`; runtime
`engine/game-runtime.ts`; sessions `engine/session/{single-session,league-session,session-manager}.ts`;
start `features/rooms/rooms.service.ts`; league `features/league/league.service.ts`.

**Frontend (reuse as-is):** `shared/services/socket.ts`, `shared/realtime/{room-socket-provider,
room-socket-context}.tsx`, `shared/types/view.ts`, `features/lobby/screen/*`, `features/in-game/
screen/{player,display,host}-game-screen.tsx` (the seam), `host-controls.ts` + `HostControlStrip`.

**Frontend (the new slice + the old flow being replaced):** new →
`features/games/missing-letters/{ui,screens,solo,multiplayer}/`; old (parity reference, will be
deleted) → `features/in-game/games/missing-letters/*`.

**The other playbook:** `docs/specs/solo-games-playbook.md` (mission, rules, design language, the
solo path). Read it first.
