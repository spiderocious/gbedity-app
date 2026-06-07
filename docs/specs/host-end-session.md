# Spec — Host ends session → boot everyone with a "room closed" screen

**Status:** spec · awaiting review (no code yet) · small slice (fullstack: 1 BE seam + WS fanout, 1 FE shared screen + wiring)
**Source of truth:** PRD §4 (room lifecycle), §10 ("If the host leaves, the room ends and players are shown the final state").

## 0. The ask
When the host clicks **End session** in the host lobby, every connected client (players + display +
the host's own other tabs) should be **booted out** and shown a clear "This room has been closed by
the host" screen — not silently left on a dead lobby.

## 1. Current state (audited)
- **Host "End session"** (`host-lobby-screen.tsx` `endSession()`) only does `navigate(ROUTES.LANDING)`.
  **No backend call** — so nobody else learns the room closed.
- **Backend** has `endRoom(code)` in the gateway, but it's only reached on **host-disconnect grace
  expiry** (PRD §10 auto-end), and it emits `ROOM_ENDED` **to the display channel only** — players
  and the host channel are never notified. There is **no host-initiated end** path (HTTP or WS).
- **Frontend** already models the end: `ServerEvent.ROOM_ENDED` → `ConnectionStatus.ENDED` in
  `room-socket-provider.tsx`. But **zero screens render the `ENDED` state** (grep confirms no
  consumer). Player-lobby + all in-game screens already hold a `RoomSocketProvider`, so they *can*
  observe it — they just don't react yet.

So the gap is three small pieces: (a) a host-initiated end trigger, (b) fan `ROOM_ENDED` to **all**
channels, (c) a shared "room closed" UI that any socket-connected screen shows on `ENDED`.

## 2. Plan

### Backend
1. **End-room trigger (host-initiated).** Add the path the host calls on "End session". Two options
   (pick in §4):
   - **A — WS action (recommended):** handle a `host.end_session` client action in the gateway
     ACTION handler — verify the sender is the host seat (it already binds host via token), then call
     the existing `endRoom(code)`. No new HTTP surface; reuses the authenticated socket.
   - **B — HTTP:** `POST /rooms/:code/end` `{ hostId }` → service verifies host → ends room +
     triggers the same gateway `endRoom`. Needs a service→gateway hook (the rooms service already
     depends on SessionManager, not the gateway — so the gateway would subscribe/observe).
   *(A is smaller and already authenticated; B is more RESTful but adds a service↔transport seam.)*
2. **Notify everyone, not just display.** Change `endRoom` to emit `ROOM_ENDED` to the host + all
   player channels too (broadcast to the room's sockets), not only `displayChannel`. One-line fanout
   fix; the auto-end (grace-expiry) path benefits identically. Disconnect the sockets after emit so
   they don't try to reconnect into a closed room.

### Frontend
3. **One shared "room closed" screen** — `shared/realtime/room-closed-screen.tsx` (or a small
   `RoomClosedOverlay`). Branded full-screen: Logo, "This room has been closed by the host." + a
   "Back to home" button → `ROUTES.LANDING`. Clears the room session (`sessionStore`) so a stale
   reconnect token isn't reused.
4. **React to `ENDED` in one place.** Add it to the provider's consumers via a tiny guard the
   socket-backed screens already share — cleanest: render the closed screen from within
   `RoomSocketProvider`'s subtree when `status === ENDED` (so player-lobby, player-game,
   display-*, host-game all get it for free, no per-screen edits). A render-prop / wrapper:
   `<RoomSocketProvider>` children are replaced by `<RoomClosedScreen>` when ended.
5. **Host's own End session** (`host-lobby-screen.tsx`) — on confirm, fire the §2.1 trigger
   (mutation/emit), then navigate home. The host lobby isn't inside a `RoomSocketProvider` today, so
   the host navigates directly; players/display get booted via the WS fanout.

## 3. Files
- BE: `engine/gateway/index.ts` (ACTION host.end_session handler + `endRoom` fanout to all channels).
  If option B: `rooms.routes.ts` + `rooms.controller.ts` + `rooms.service.ts` + a gateway end-hook.
- FE: `shared/realtime/room-closed-screen.tsx` (new), `room-socket-provider.tsx` (render closed
  screen on `ENDED`), `host-lobby-screen.tsx` (`endSession` calls the trigger).
- Constants: a `ClientEvent.ACTION` payload type `{ type: 'host.end_session' }` (named constant, no
  inline string) on both sides; reuse existing `ServerEvent.ROOM_ENDED`.

## 4. Open confirms
1. **End trigger — WS action (A) or HTTP endpoint (B)?** *(Recommend A: authenticated socket already
   open, smallest change, no new service↔transport seam.)*
2. **Closed-screen placement — inside `RoomSocketProvider` (one place, all socket screens covered) or
   a per-screen guard?** *(Recommend inside the provider.)*
3. **Copy:** "This room has been closed by the host." + "Back to home" — ok, or different wording
   (PRD §10 says "shown the final state" — do we show last scores, or just the closed notice for
   v1)? *(Recommend: closed notice only for this slice; final-state recap is a separate feature.)*
4. **Host's other devices:** the host clicking End on one tab should also boot the host's *display*
   tab — covered by the all-channels fanout (§2.2), confirm that's desired.

## 5. Done when
- Host clicks End session → confirm → all players + display show the "room closed" screen within a
  second; their sockets disconnect; session cleared.
- The existing auto-end (host-disconnect grace) path also boots players (not just display) via the
  same fanout fix.
- Typecheck ✅ · lint ✅ · a smoke test that the closed screen renders on `ENDED`.
