# Frontend Investigation — Game App In-Play Experience (`apps/game/src`)

**Author:** QA (backend QA, cross-checking the frontend against the verified backend contract)
**Date:** 2026-05-31
**Reported symptoms:** games feel stuck; the **host can't play**; the **host screen is stuck showing the display screen**; bad experience. User has played Wordshot; asked to verify all 5 backed games + the screens.
**Method:** read the realtime + in-game layer; cross-checked every frontend assumption against the **real backend** (live Socket.IO probe — I know the exact view shapes from the backend QA passes). Read-only — **no frontend files changed**.

> **TL;DR.** The host's experience is broken **by routing**, not by the games. When the host taps
> Start, their *own browser navigates to the **display** game screen* (`/d/:code/game`) — so the
> host literally sees the shared-screen view and has no controls and no way to play. The real
> host-play surface (`HostGameScreen`) is a **static mock with no socket** and is **never routed to
> in a live game**. Separately, the realtime provider **discards the `audience` field**, so a
> client can't distinguish host/player/display views — and the host seat receives *both* host- and
> player-audience patches interleaved. There's also no timer in any live view, which is most of the
> "feels stuck" feeling. The player and display surfaces are largely wired correctly.

---

## 0. How I verified (backend is ground truth)

Brought up the real backend (Mongo + Redis, seeded content) and drove it with a Socket.IO client,
joining as host + player + display simultaneously, then started Wordshot and captured every
`server.view` with its `audience`. Key captured fact:

```
HOST   received 6 views: [{aud:"host",phase:"round"},{aud:"player",phase:"round"}, … {aud:"host",phase:"reveal"},{aud:"player",phase:"reveal"}]
PLAYER received 4 views: [{aud:"player",…}]
DISPLAY received 3 views: [{aud:"display",…}]
HOST view audience tags seen: ["host","player"]   ← host seat gets BOTH streams
```

So the backend behaves exactly as my engine QA verified: the host is bound to the host **seat**
(which is also a player), and the runtime broadcasts a `host`-audience view **and** a
`player`-audience view to it. The frontend has to (a) put the host on a surface that *uses* those
patches, and (b) keep the right audience. It does neither.

---

## 1. Findings (ranked by impact)

| ID | Severity | Finding |
|----|:--------:|---------|
| **F-1** | **P0** | Host is routed to the **display** screen on Start — can't play, sees the shared-screen view. |
| **F-2** | **P0** | `HostGameScreen` (the only host in-play screen) is a **static mock with no socket**, and is **never reached** in a live game. |
| **F-3** | **P1** | Realtime provider **drops the `audience`** from `server.view`; host seat receives interleaved host+player patches → nondeterministic rendering. |
| **F-4** | **P1** | **No timer/countdown** in any live view — backend view carries no deadline and no renderer shows one, so every game "feels stuck" between actions. |
| **F-5** | **P2** | `DisplayLobby` Start **hardcodes Wordshot** and ignores the host's queued/configured game. |
| **F-6** | **P2** | Quizzes won't start from the normal host flow — start sends **no `rounds`** but the seeded deck is tiny, and the lobby comments say "quizzes deck is unseeded"; only Wordshot is treated as reliably startable. |
| **F-7** | **P2** | Live reveal/board mismaps backend score fields → standings can render as `0`/blank. |
| **F-8** | **P3** | Host in-play **chrome is fake** — "Round 2 · 3 left", Pause/Skip/End are `DrawerService.toast`/no-op stubs, not wired to anything. |

---

## 2. Root causes (with evidence)

### F-1 / F-2 — Host can't play; host stuck on the display screen — **P0**

**The routing.** In [`host-lobby-screen.tsx`](../../../apps/game/src/features/lobby/screen/host-lobby-screen.tsx) `startOne()`:
```ts
startGame.mutate({ code, hostId, gameId: q.backendId, config: q.config }, {
  onSuccess: () => go(`${pathWith(ROUTES.DISPLAY_GAME, { code })}?live=${q.backendId}`),  // ← host → DISPLAY game
});
```
And [`display-lobby-screen.tsx`](../../../apps/game/src/features/lobby/screen/display-lobby-screen.tsx) `start()` does the same (`navigate(DISPLAY_GAME)`). So **the host's phone lands on `/d/:code/game`** — the display surface — which is exactly "the host screen is stuck and displaying as if it's the display screen." It's not stuck; it was *sent there*.

**The dead screen.** [`host-game-screen.tsx`](../../../apps/game/src/features/in-game/screen/host-game-screen.tsx) is the only host in-play screen, but it:
- opens **no `RoomSocketProvider`** and reads **no live patch** — it renders `content.renderDisplay()` (static mock content) and fake "Host controls";
- is only ever navigated to with `?mock=…` (preview gallery, and "Play again" on the result screen). Grep of `HOST_GAME` usage shows **zero live navigations** — only mock/preview.

**Net:** there is no live host-play path at all. The host can neither see a player-style play surface nor drive real host controls. Two screens conflated and both wrong: the host gets the display, and the would-be host screen is a mock no one reaches.

**Fix direction:** on Start, the host should navigate to a **live host surface** — either (a) the host plays as a player (host is a player seat per the PRD), so route the host to a live player-style screen that *also* shows host controls, or (b) a dedicated live `HostGameScreen` that opens a `RoomSocketProvider role=host`, renders the player projection (the host seat gets `audience:player` patches) for play, plus real host controls. The display screen should be opened on the **TV/separate device** via the `display_url`, not on the host's phone.

### F-3 — Provider discards `audience`; host gets interleaved streams — **P1**

[`room-socket-provider.tsx`](../../../apps/game/src/shared/realtime/room-socket-provider.tsx):
```ts
socket.on(ServerEvent.VIEW, (raw) => {
  const parsed = ServerView.safeParse(raw);          // ServerView = { audience, patch }
  if (parsed.success) { setStatus(LIVE); setPatch(parsed.data.patch); }  // ← audience thrown away
});
```
The backend sends a **separate view per audience**, and (verified above) the **host seat receives both `audience:"host"` and `audience:"player"` patches**. Because the provider keeps only the latest `patch` regardless of audience, a host surface would flip between the host projection and the player projection on every broadcast — nondeterministic content. Players/display happen to be fine *today* only because each of them receives a single audience; the bug bites the moment the host surface consumes patches.

**Fix direction:** keep `audience` alongside `patch` (or keep a per-audience map); the host surface selects the audience it needs (player projection for play). Also note `sendAction`'s `useMemo` closes over `socketRef.current` with deps `[status,patch,errorCode]` — works because it reads the ref at call time, but it's worth a comment; not a bug.

### F-4 — No timer anywhere → "feels stuck" — **P1**

The live Wordshot patch keys are `phase, roundIndex, rounds, letter, category, ranked, yourScore, yourSubmission` — **no deadline/timer**. The frontend has a `TimerPill` and a `RoundHeader({timer})` prop, but **no live renderer ever passes a `timer`** (grep confirms `RoundHeader left={…}` with no timer arg). So during a round nothing visibly counts down; the screen just sits until the server flips the phase. Combined with F-1 (host sees a static-ish display), this is most of the "feels stuck / bad experience."

**Fix direction:** the backend view needs to expose a `deadline`/`secondsLeft` (engine state has the epoch-ms `deadline`; it's just not projected in `view()`), and the renderers should show a countdown. This is a **backend view-projection gap + frontend wiring** — flagging both halves.

### F-5 — Display lobby hardcodes Wordshot — **P2**

[`display-lobby-screen.tsx`](../../../apps/game/src/features/lobby/screen/display-lobby-screen.tsx) `start()`:
```ts
// Default to wordshot — it has seeded content and always starts (quizzes deck is unseeded).
startGame.mutate({ code, hostId: host.hostId, gameId: RealGameId.WORDSHOT }, …);
```
If the host starts from the display lobby, it **always launches Wordshot**, ignoring whatever game the host queued/configured. That's why "I've only played Wordshot so far" — the display-lobby Start button can't launch anything else.

### F-6 — Quizzes (and others) effectively unstartable from the normal flow — **P2**

[`config-map.ts`](../../../apps/game/src/shared/games/config-map.ts) `buildStartConfig()` returns `{}` and a comment says it deliberately omits `rounds` because "the backend 422s when it exceeds seeded content." Combined with the seeded quiz deck being tiny and the display lobby's "quizzes deck is unseeded" comment, the practical result is the host flow is tuned around Wordshot and other games are fragile to start. (Backend side: I verified Quizzes *does* run end-to-end with seeded `nigerian` content and engine defaults — so this is a frontend config/seed-assumption issue, not a backend block.)

### F-7 — Reveal/board score-field mismap — **P2**

[`live-renderers.tsx`](../../../apps/game/src/features/in-game/live/live-renderers.tsx) `LiveBoard` reads `r.points ?? r.pct ?? 0` and `r.name ?? r.playerId`. The backend's end-of-game board entries are `{playerId, points}` (verified in `game_plays`/leaderboard) — there's no `name`, so rows render the raw `playerId` (or `—`), and per-round reveal patches that carry no rows show "Next round coming up…". Standings will look wrong/blank to players. Needs the backend to project display names into the board view, or the FE to resolve `playerId → nickname` from the lobby roster.

### F-8 — Fake host chrome — **P3**

`HostGameScreen` shows a hardcoded "Round 2 · 3 left" and Pause/Skip/End-round buttons that are `DrawerService.toast('Paused')` / `onConfirm: () => undefined` — no backend action is sent. Even once F-1/F-2 are fixed, host controls are non-functional stubs. (Backend note: host-only actions are now gated by `ctx.role` after the BUG-A fix, so wiring real host controls is *possible* — there's just no client emitting them yet.)

---

## 3. What's actually working (so the fix stays surgical)

- **Player flow is correct:** join → `PlayerLobbyScreen` auto-advances to `PLAYER_GAME` on the first non-lobby patch → `LivePlayer` opens a player socket, renders per-game input, and `sendAction` emits the right action shapes. Action shapes match the backend (`quizzes.answer{questionIdx,choiceIdx}`, `wordshot.submit{text}`, `word_bomb.submit{text}`, `hot_take.submit/vote`, `plead.submit{argument}`) — verified against the server.
- **Display flow is correct:** `DisplayLobbyScreen` (display socket) auto-advances to `DISPLAY_GAME`; renderers exist for all 5 games; `detectLiveGame` discriminates games by patch shape correctly against real patches.
- **`detectLiveGame` ordering is sound** against the real shapes (scenario→plead, defences→hot-take, holderId/used→bomb, options/qIndex→quiz, letter/ranked→wordshot).
- **Reconnect** is wired (`server.resumed` → LIVE; reconnect token from `sessionStore`).
- **Per-game player renderers** (input fields, vote buttons, MCQ) are reasonable and send correct actions.

So the games themselves largely work on the player + display surfaces. **The break is concentrated in the host path + the realtime audience handling + the missing timer.**

---

## 4. Recommended fix order

1. **F-1 + F-2 (P0):** give the host a **live host-play surface**. Route Start → a host game screen that opens `RoomSocketProvider role=host`, renders the **player projection** for play (host is a player seat) plus host controls; open the display on the separate device via `display_url`. Stop sending the host to `/d/:code/game`.
2. **F-3 (P1):** keep `audience` in the provider; the host surface selects the player-audience patch for play (and the host-audience patch for host-only chrome if/when needed).
3. **F-4 (P1):** project a `deadline`/`secondsLeft` in the backend `view()` and render a countdown (backend + frontend).
4. **F-5 / F-6 (P2):** display-lobby Start should launch the host's chosen game; reconcile the quizzes/seed config assumption.
5. **F-7 (P2):** resolve player names for the board (FE roster map or backend projects names).
6. **F-8 (P3):** wire real host controls to host-only actions (backend now gates them by role).

---

## 5. Notes
- **Read-only investigation** — no frontend files were modified. The `M` files under `apps/game/src`
  in git are the dev's existing uncommitted work (worktree ahead of HEAD), not my edits.
- Two findings (F-4 timer, F-7 board names) have a **backend half** — the engine `view()` projections
  don't expose a deadline or display names. Those are projection additions on the engine side; I can
  spec the exact fields if useful.
- I verified all assertions against the live backend; I did not drive the *browser* UI (no headless
  browser here) — the host-routing and dead-screen findings are from the code + route graph, which
  are unambiguous, and the audience/interleaving finding is from the live socket capture.
