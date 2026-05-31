# Gbedity — All Screens UI Specification

**Status:** UI-only build spec. No backend, no API integration, no game logic. Pure presentational React components with `useState` for local interactivity. Hard-coded text and mock state everywhere. The goal is a complete, navigable UI shell that can be wired to the real engine later without redesign.

**Sketch & Guess (#15) is intentionally excluded** from this spec. It is a known v2 deferral. Do not build screens for it.

**Audience:** the frontend agent. Assumes existing knowledge of feature-sliced design, the Gbedity design system (Canvas Mint, Stage Cobalt, Action Green, Accent Orange, Fraunces + Nunito, layered cards, no shadows), and the locked component library.

---

## How to read this document

The spec is in **two layers**:

1. **Layer 1 — Universal screens** (§§1–8). Screens that exist regardless of which game is being played. Built once, reused. Includes onboarding, lobby, catalogue, configure-shell, in-game shell, post-game shell, league flow, and edge states.
2. **Layer 2 — Per-game screens** (§§9–26). Screens unique to each of the 18 games. Each game gets a section covering its configure, in-game, and post-game *content*, slotted into the universal shells from Layer 1.

If a screen isn't described in a per-game section, fall back to the universal pattern. If a screen requires something the universal pattern doesn't cover, the per-game section will say so explicitly.

**Always-true rules** that apply to every screen in this document:

- Three device contexts: **display** (TV/monitor/laptop, landscape, large-text), **host phone** (portrait, full control), **player phone** (portrait, restricted control). Every screen description names which contexts it applies to.
- Mock all dynamic data with hard-coded values. Player names: Tobi, Ada, Funmi, Kemi. Room code: `GBE-4ZK`. Numbers vary per screen but stay realistic.
- All buttons, inputs, and interactive surfaces respond to hover/press/focus per the locked design system.
- All motion follows the locked spec: 150–250ms default, spring for celebration only, `prefers-reduced-motion` respected.
- All copy follows the locked brand voice: confident-host tone, no exclamation points except in celebration moments, no "click here," no "exciting!"
- All "API drift insurance" screens (loading, error, empty, reconnecting, AI-pending) are listed in §8 and reused across games.

---

# LAYER 1 — UNIVERSAL SCREENS

---

## §1. Entry & onboarding screens

### 1.1 Landing page (`/`)

**Context:** any device with a browser. Acts as the public marketing page and the entry point for both join and host flows.

**Layout sections, top to bottom:**

1. **Header strip** — Gbedity wordmark left, "How it works" link right. Sticky on scroll, fades canvas-mint at 50% scroll.
2. **Hero** — eyebrow pill ("FREE · NO INSTALLS · NO ACCOUNTS"), Fraunces hero headline ("Game night for the room."), Nunito subhead. On the right (desktop) or below (mobile), an animated demo card showing 4 cycling in-game moments (Word Bomb numeral, Catch the Lie statements, Plead Your Case verdict, Wordshot prompt). The demo card has the Stage Cobalt frame (4px) and a caption beneath: "Live · sample play."
3. **Join + Host cards** — two cards side-by-side (desktop) or stacked (mobile). The Join card has the room-code input (6 characters, monospace, auto-uppercase, dash auto-inserted after 3 chars), a "Join room" primary button (Action Green; disabled state is Action Green at 50% opacity, not Canvas Mint), and a "Scan QR instead" ghost link. The Host card has a single "Start a room" primary button (Action Green). Three sub-modes (Quick Play / Create Game / League) live inside the host flow, not on the landing.
4. **"Eighteen ways to play" catalogue** — section heading, subhead, filter pills (functional — clicking a category filters the catalogue with non-matching tiles fading to 0.2 opacity, scale 0.95, 200ms, no layout shift), then a 3-column grid (responsive to 2 on tablet, 1 on mobile) of 18 catalogue tiles. Each tile uses the locked tile design: category-tinted top half with icon badge and category label, white bottom half with player range + duration meta line and one-line description. Internal game number (01–19, skipping 15) in small grey at top-right corner of the tinted half.
5. **"Made for nights like these"** — three cards: Family game night (couch icon), Friends-over party (pizza icon), Sunday with the cousins (trophy icon). Each card has one line of copy in Nunito Regular.
6. **"How it works"** — three steps with full-colour icons from the secondary palette (TV in Stage Cobalt, phone in Berry Purple, confetti in Accent Orange), large Fraunces "01/02/03" numerals tinted to match each step's accent. Each step has heading + 2-line body.
7. **Footer** — "Gbedity · Free to play · English & Pidgin · Made in Lagos."

**Motion behaviour:**

- On first hero load (once per session): a 3-particle confetti burst centred above the headline, falling and fading over 1.5s.
- Hero demo card cycles every 3 seconds with a 250ms crossfade between states.
- Catalogue tiles fade-in-up on scroll with 80ms stagger, once only.
- Hover on each catalogue tile: lift 8px, shadow appears, the small game number translates slightly down-right.
- Filter pill click: matching tiles stay full opacity; non-matching tiles fade to 0.2 opacity scale 0.95 (no layout shift). 200ms ease-out.
- "How it works" icons animate in once when scrolled into view: TV glows briefly, phone wiggles, confetti bursts.
- "Start a room" button click: stage-cobalt curtain wipe across the screen (350ms) before route transition to `/host/new`.

**Mock state:**

- 18 catalogue tiles (skip Sketch & Guess #15). Use the per-game descriptions in Layer 2 §§9–26 for the tile copy.
- Filter pills: "All games" (default selected), "Quick & Casual," "Brain & Strategy," "Party & Social," "Immersive."

### 1.2 Player join — code entry (`/join`)

**Context:** player phone, portrait.

**Layout:**

- Header strip (Gbedity wordmark only, no nav).
- Canvas centred: a card containing "JOIN A ROOM" eyebrow, Fraunces "Got a code?" heading, two-line subhead ("Type the six characters from the shared screen — or scan the QR."), a large room-code input (6 characters, monospace, auto-uppercase, dash auto-inserted after 3 chars), and a "Join room" primary button beneath.
- A "Scan QR instead" ghost link beneath the button.

**Interactive behaviour:**

- The input accepts only alphanumeric characters. As the user types, characters auto-uppercase. Dash is auto-inserted after the third character (so user types `GBE4ZK` and sees `GBE-4ZK`).
- The Join button is disabled until 6 valid characters are entered (Action Green at 50% opacity).
- On valid 6-character entry, the Join button becomes fully enabled (Action Green at 100%) and a subtle pulse animation fires once on the button.
- Clicking "Scan QR instead" opens a modal or routes to a mock QR scanner screen (see §1.4).
- Clicking "Join room" routes to `/join/nickname`.

**Mock state:**

- Hard-code the valid room as `GBE-4ZK`. Any other code shows an error toast: "Couldn't find that room. Check the code and try again." (Toast appears below the input, Tomato Red background, white text, 3s auto-dismiss.)
- If the user types fewer than 6 characters and clicks Join: shake the input gently (200ms, 4px left-right) and show inline error: "Six characters needed."

### 1.3 Player join — nickname (`/join/nickname`)

**Context:** player phone.

**Layout:**

- Card centred: "ALMOST IN" eyebrow, "What should we call you?" Fraunces heading, single text input (placeholder: "Your nickname"), "Join the room" primary button.
- Below: small grey text "Visible to other players. No accounts, no email."

**Interactive behaviour:**

- Input accepts up to 16 characters. Trim whitespace on submit.
- Profanity filter applied client-side (mock list of 5 banned words; if matched, show "Pick another nickname" inline error in Tomato Red).
- On submit, route to `/lobby/:roomCode` (the player lobby — §2.2).

**Mock state:**

- Pre-fill the input with a randomised cheerful nickname suggestion (e.g., "BoldOkra," "QuietJollof," "SmoothAmala") that the user can keep or replace. Suggestion regenerates if user clears it.

### 1.4 QR scan screen (`/join/qr`)

**Context:** player phone.

**Layout:**

- Full-screen camera viewport mock (display a placeholder image of a phone camera framing a QR code).
- Overlay frame in Action Green showing the scan zone.
- Below: "Point your camera at the QR on the shared screen."
- Ghost link: "Type the code instead."

**Interactive behaviour:**

- No actual camera access. After 2 seconds on this screen, simulate a successful scan: pulse the green frame, show "Found it" toast, then route to `/join/nickname`.
- Clicking "Type the code instead" routes back to `/join`.

### 1.5 Host start screen (`/host/new`)

**Context:** any device. Treats this device as the host's controller.

**Layout:**

- Header strip with back arrow to landing.
- Centred card: "HOST A ROOM" eyebrow, "Open the room" Fraunces heading, brief explanation: "Open the room on a screen the room can see. Players join from their phones."
- Three large mode tiles (single column stack):
  - **Quick Play** — bolt icon, "Pick a game, defaults, start in seconds."
  - **Create Game** — sliders icon, "Pick a game and tune every setting."
  - **League Play** — trophy icon with Berry Purple "LEAGUE" badge, "Queue several games into one session with a combined leaderboard."
- Below the three modes: "Already opened on the shared screen?" with a "Open on this device only" ghost link.

**Interactive behaviour:**

- Each mode tile responds to hover (lift) and click (scale 1.02, then route).
- Quick Play routes to `/host/catalogue?mode=quick`.
- Create Game routes to `/host/catalogue?mode=create`.
- League Play routes to `/host/league/new`.

### 1.6 Host display setup (`/host/display`)

**Context:** any device.

**Layout:**

- Centred card: "SHARED SCREEN" eyebrow, "Where should the game play?" heading.
- Two options stacked:
  - **This device IS the shared screen.** Subhead: "Best for laptops on a TV or projector." Button: "Use this device →"
  - **I'll open it on another screen.** Subhead: "We'll give you a link to open there." Button: "Get the link →"
- Below: small grey text "You can change this any time."

**Interactive behaviour:**

- "Use this device" routes to `/host/room/:code/display` (full-screen display view, current device).
- "Get the link" opens a modal showing a short URL (`gbedity.app/d/4ZK`) and a "Copy link" button. Modal has "Done" button to dismiss and route to `/host/room/:code` (the host control view on this device).

---

## §2. Lobby screens

The lobby has two states:

- **Pre-game lobby** — players are joining, no scores exist yet
- **Between-games lobby** — a game just ended, scores exist, host is choosing what's next

Both states share most chrome.

### 2.1 Display lobby (`/host/room/:code/display`)

**Context:** display, landscape.

**Layout:**

- Top bar: Gbedity wordmark left, room code in large monospace centre, small "How players join" link right.
- Main centre: large QR code (Action Green border), large room code beneath ("GBE-4ZK"), instruction beneath: "Open gbedity.app on your phone and enter the code — or scan."
- Right rail: player list. Each joined player is a chunky pill containing initial-circle avatar (category colour rotation), nickname (Fraunces), and "joined Xs ago" meta. Players appear with a slide-in-from-right + fade animation as they join.
- Bottom bar: "Waiting for players · X joined" in Fraunces, host-only "Configure game" and "Start" buttons.

**Pre-game vs Between-games difference:**

- **Pre-game**: warm-chunky player rows (locked design from system).
- **Between-games**: hairline-divided rows with ranked + score on the right (also locked).

**Interactive behaviour:**

- No host controls on the display device itself unless the host explicitly chose "Use this device" as both controller and display (§1.6). In that case, a compact host-control strip appears at the bottom: "Configure," "Start game," "End session."
- Players appear in real-time as they join (in mock state, simulate one player joining every 4 seconds: Tobi → Ada → Funmi → Kemi).

**Mock state:**

- 4 players join in sequence over the first 16 seconds, then the lobby holds with 4 players.

### 2.2 Player lobby (`/lobby/:code`)

**Context:** player phone.

**Layout:**

- Top bar: Gbedity wordmark left, room code chip right (just for reference).
- Card centred: "YOU'RE IN" eyebrow, host nickname in Fraunces "Tobi's room," subhead "Waiting for the host to pick a game."
- Player roster beneath: each player as a chunky pill (same design as display version, smaller scale).
- Bottom of card: animated waiting indicator (three dots, looping pulse).
- Ghost link at very bottom: "Leave room."

**Interactive behaviour:**

- The current user's pill is highlighted with a thin Action Green border + "(you)" tag in small caps.
- "Leave room" shows a confirmation toast ("Leave the room? You'll need the code to come back.") with "Stay" and "Leave" buttons. Leave routes back to `/`.

**Mock state:**

- Show 4 players. Current user is Funmi.

### 2.3 Host lobby (`/host/room/:code`)

**Context:** host phone.

**Layout:**

- Top bar: Gbedity wordmark left, room code chip right, settings-gear icon far right (opens room settings drawer — §5.4).
- Card 1 — Room status: room code in large Fraunces, "X players joined" beneath.
- Card 2 — Player roster: chunky pills, host pill labelled "(you · host)." Each non-host player has a 3-dot menu opening: "Make host," "Boot player."
- Card 3 — Next game card: if no game selected, shows "Pick a game" CTA → `/host/catalogue`. If a game is queued (post-configure), shows the selected game tile + "Start game" primary button.
- Bottom action bar: "End session" ghost button (with confirmation: "End the session for everyone?").

**Interactive behaviour:**

- "Make host" shows confirmation toast and re-orders pills so the new host is first.
- "Boot player" shows confirmation toast; on confirm, pill animates out.
- "Pick a game" routes to `/host/catalogue`.

**Mock state:**

- 4 players (Tobi, Ada, Funmi, Kemi). Host is Tobi.

### 2.4 Between-games lobby — extras

When the lobby is post-first-game (i.e., at least one game has ended), the display and host lobbies show additionally:

- **Display:** "Last game · Word Bomb · Ada won · 1,420" small label above the player rows. Rows are now hairline-divided (matching locked design) with rank number + score on the right.
- **Host:** small banner card "Played 1 game · Ada leads with 1,420" + ghost link "See full scores."
- **Host next-game CTA:** "Pick another game" instead of "Pick a game."

---

## §3. Catalogue & game selection

### 3.1 Game catalogue (`/host/catalogue`)

**Context:** host phone (primary) or display (if host is using display device).

**Layout:**

- Top bar: back arrow → host lobby, "Pick a game" Fraunces heading.
- Filter pills: "All games · Quick · Brain · Party · Immersive." Default "All games."
- 3-column grid (responsive) of 18 catalogue tiles. Use the per-game data from Layer 2 §§9–26 for copy and category colours.
- Each tile shows: category-coloured top half (game number top-right in small grey, icon badge top-left, category label, game name in Fraunces), white bottom half (player range · duration · one-line description).
- Bottom of page: ghost link "Back to lobby."

**Interactive behaviour:**

- Filter pills filter the grid with the locked fade-to-0.2 motion.
- Tile hover: 8px lift + shadow + number translates.
- Tile click: routes to `/host/configure/:gameId`.

**Mock state:**

- 18 tiles using Layer 2 data. Filter starts on "All games."

### 3.2 League queue builder (`/host/league/new`)

**Context:** host phone.

**Layout:**

- Top bar: back arrow, "Build the league" Fraunces heading.
- Card 1 — League settings: name input ("Friday Night League"), aggregate scoring dropdown (Sum / Average / Top-3 / Custom), default game weight (1×).
- Card 2 — Queued games list. Empty state: large illustration (stacked playing cards), "No games yet" + "Add a game" primary button. Once games are added, each is a row: game number, name, configured duration, weight selector (1× / 2× / 3×), drag handle, remove icon.
- "Add a game" primary button beneath the queue.
- Bottom action bar: "Start league" primary button (disabled until ≥2 games queued), "Cancel" ghost link.

**Interactive behaviour:**

- "Add a game" routes to `/host/catalogue?mode=league`. After configure, returns here with the game added to the queue.
- Drag-handle: vertical reorder with smooth motion.
- Remove icon: confirmation toast.
- Weight selector: pill toggle group.

**Mock state:**

- Pre-load with 3 sample queued games: Word Bomb (1×), Catch the Lie (2×), Plead Your Case (1×).

---

## §4. Configure shells

Every game has a configure flow. The shell is universal; the content sections inside it are per-game (Layer 2).

### 4.1 Configure layout (`/host/configure/:gameId`)

**Context:** host phone.

**Layout:**

- Top bar: back arrow → catalogue, game number badge (e.g., "06"), game name in Fraunces ("Word Bomb"), small "Use defaults" ghost button right.
- Game intro card (collapsible): game number badge, name, player range · duration, one-paragraph description.
- Stacked config group cards. Each group is a card with an uppercase Nunito SemiBold label, then form rows. Group cards from Layer 2 per-game §s describe the specific groups.
- **Preview rail** (right side, desktop) or **collapsed preview** (mobile, expandable): shows live previewed consequences of current config. Game-specific content from Layer 2 per-game §s.
- Sticky bottom action bar: "Start game" primary (Action Green), "Use defaults" secondary (white with green border), "Back" ghost.

**Interactive behaviour:**

- Every config change updates the preview rail in real time (mocked: hard-coded values that match the current config selection).
- "Use defaults" resets every field and triggers a brief flash on each field that changed (Canvas Mint background pulse, 200ms).
- "Start game" routes to game-specific in-game shell (§5).

### 4.2 Universal config controls

The following controls appear in many games. Build them once as reusable components:

- **Number stepper** (Lives, Round count): `–`, value, `+` with clamp to min/max.
- **Time stepper** (seconds, minutes): same but with unit label.
- **Pill toggle group** (Easy / Mixed / Hard, Family / Friends / Spicy / 18+): tap to select, selected has Action Green background + white text.
- **Multi-select toggle group** (Content tag filter): same as pill toggle but multiple can be selected.
- **Dropdown** (Aggregate scoring, Translation focus): standard modal-style picker with rounded card sheet.
- **Custom content opener**: button "Custom deck (12 selected)" → opens a sheet for paste/select/upload of custom content (§4.3).
- **Slider** (Accuracy weight, AI criterion weights): horizontal slider in Action Green with current value chip above the thumb.
- **Toggle switch** (Bonus round on/off, Show feedback to losers): standard iOS-style switch.

### 4.3 Custom content sheet

**Context:** host phone, modal sheet rising from bottom.

**Layout:**

- Sheet handle bar at top.
- Heading: "Custom [content]" (e.g., "Custom questions," "Custom prompts").
- Tab strip: "Paste · Type · Choose existing."
- **Paste tab:** large textarea with placeholder showing the expected format (e.g., for Quiz questions: `Question | option1 | option2 | option3 | option4 | answerIndex`).
- **Type tab:** structured form fields for entering one item at a time + "Add another" button.
- **Choose existing tab:** list of previously saved custom decks (mock 3 entries).
- Bottom action bar: "Use this content" primary, "Cancel" ghost.

---

## §5. In-game shells

The in-game flow shares a layout shell across all games; the content of the centre card is per-game.

### 5.1 Display in-game (`/d/:code/game`)

**Context:** display.

**Layout:**

- Top bar (slim): game number + name left (e.g., "06 · Word Bomb"), round indicator ("Round 2 · 3 left") right.
- Main centre: large white card with the game-specific in-game content (Layer 2 per-game §s). The card is centred and large; the canvas-mint background fills around it.
- Bottom bar (slim): host control hint ("Host controls on phone").

**Interactive behaviour:**

- No interaction on display itself (display-only).
- State changes pushed from host phone update this view in real time (mocked: state cycles automatically every 8 seconds to show the screen sequence).

### 5.2 Host in-game (`/host/room/:code/game`)

**Context:** host phone.

**Layout:**

- Top bar: small game badge, "Round 2 · 3 left" indicator, settings-gear (opens game control drawer).
- Status card: shows what's happening on the display in compact form (game-specific from Layer 2).
- Host controls card: "Pause / Resume," "Skip turn," "End round early," "End game" — buttons styled per the design system.
- Bottom: if the host is also playing, player input area beneath the host controls (game-specific from Layer 2). Host can hide this with a "Hide my play" toggle.

**Interactive behaviour:**

- All host-control buttons show confirmation modals before acting (except Pause/Resume which is immediate).
- "End game early" shows "End the game now? Current scores will count" with confirm/cancel.

### 5.3 Player in-game (`/p/:code/game`)

**Context:** player phone.

**Layout:**

- Top bar: room code chip left, current score chip right ("You: 320 pts").
- Status card: game-specific compact status (Layer 2).
- **Active state:** player input area (game-specific). Large primary action button.
- **Waiting state:** "Wait for your turn" or "Others are voting" message with animated indicator.
- **Spectator state:** "Spectating this round" tag, see display content in compact, no input.

**Interactive behaviour:**

- The active/waiting/spectator state is driven by per-game logic (Layer 2).
- Input lock animations when the player submits (button collapses to "Submitted" checkmark, brief Action Green pulse).

### 5.4 Game control drawer

**Context:** host phone, side drawer sliding in from right.

**Layout:**

- Drawer with sections: Game info, Pause/Resume, Skip turn, End round, End game, Boot player (with player list), Settings.
- Each item is a row with icon + label + chevron.

---

## §6. Post-game / round-end shells

### 6.1 Display post-game (`/d/:code/result`)

**Context:** display.

**Layout:**

- Stage Cobalt poster frame around the entire content.
- Title bar inside the frame: "Final scores" in Fraunces white-on-cobalt, game name + round indicator right.
- Main white card area:
  - **Celebration card** (top, game-specific from Layer 2 per-game §s). For most games this includes the winning answer/argument/guess + meta stats.
  - **Orange winner bar** — single solid Accent Orange row showing "winner · [avatar] · [name]" + score in large Fraunces.
  - **Ranked leaderboard rows** beneath, hairline-divided. Each row: rank, avatar, name, score.
- Bottom action area: "Play again," "Pick another," "End session" buttons.

**Mock state:**

- Use the locked Word Bomb post-game design (Ada wins with 1,420; Tobi 1,180; Funmi 940; Kemi 720) as the default template. Per-game variations live in Layer 2.

### 6.2 Host post-game (`/host/room/:code/result`)

**Context:** host phone.

**Layout:**

- Compact result view: winner banner, leaderboard list.
- Primary actions: "Play again," "Pick another," "End session."
- Secondary: "Share result" (mock — opens a sheet with a placeholder share dialog), "View round detail" (opens full round breakdown — §6.3).

### 6.3 Round detail view (`/host/room/:code/round/:n`)

**Context:** host phone or display.

**Layout:**

- Per-player breakdown: each player's answers/actions across the round with their per-answer scores.
- For AI games: full AI rationale per player.
- Ghost button "Back to scores."

### 6.4 League final results (`/d/:code/league-result`)

**Context:** display.

**Layout:**

- Stage Cobalt poster frame, "League Final" title.
- Three top finishers in a podium layout (1st centre raised, 2nd left, 3rd right) — each with avatar, name, total league score, and a small breakdown of "[X% in Word Bomb] · [Y% in Catch the Lie] · ..."
- Beneath the podium: full ranked list.
- Bottom: "Start another league," "End session."

---

## §7. Player-side post-game

### 7.1 Player result view (`/p/:code/result`)

**Context:** player phone.

**Layout:**

- Card: "You came [rank]" headline in Fraunces, current score in large Fraunces beneath.
- Personal summary: number of correct answers / lies fooled / highest single-round / etc. (game-specific where applicable).
- Action buttons: "Stay for next game" primary (just confirms presence), "Leave session" ghost.

**Mock state:**

- Show as if current user is Funmi, came 3rd with 940.

---

## §8. Edge state screens (API drift insurance)

These cover the corners where backend behaviour is uncertain. Build them all upfront so any API decision is already accommodated.

### 8.1 Empty states

| Screen | When | Treatment |
|---|---|---|
| Empty catalogue | (Won't happen in v1 but build anyway) | Friendly illustration + "No games available" + "Refresh" ghost button |
| Empty league queue | New league, no games queued | Stacked playing cards illustration + "No games yet" + "Add a game" primary |
| Empty custom deck list | Host has no saved decks | Speech-bubble illustration + "You haven't saved any decks yet" + "Create your first" primary |

### 8.2 Loading states

| Screen | Treatment |
|---|---|
| Joining a room | Full-screen card: "Joining GBE-4ZK..." with animated 3-dot indicator |
| Submitting an answer | Button collapses to spinner inside its own footprint, 300ms |
| AI evaluating (Plead Your Case) | Card overlay: "The AI is reading the arguments..." with a Fraunces dignified spinner + small text "Usually 6–10 seconds" |
| League advancing to next game | Card overlay: "Loading [next game]..." with progress dots |
| Display reconnecting after disconnect | Banner at top of display: "Reconnecting..." in Sun Yellow; fades when connection restored |

### 8.3 Error states

| Screen | When | Copy |
|---|---|---|
| Invalid room code | Player enters bad code | Toast: "Couldn't find that room. Check the code and try again." |
| Profanity nickname rejected | Player tries banned nickname | Inline error: "Pick another nickname." |
| Room full | Lobby cap reached (mock at 50) | Toast: "This room is full. Try again later or ask the host to make space." |
| Host left | Host disconnects mid-game | Display banner: "Host disconnected. Holding the room for 60s..." with countdown |
| Game requires more players | Host tries to start with < min | Inline error on Start button: "Word Bomb needs at least 3 players." |
| Player kicked | Player gets booted | Modal: "You've been removed from this room." + "Find another room" CTA |
| Server error | Generic 500-ish failure | Card: "Something went sideways on our end." + "Try again" primary + "Tell us what happened" ghost link |
| Validation service down | (Wordshot, Spelling Fast) | Card: "We can't check answers right now. Try again in a moment." with retry CTA |
| AI service down | (Plead Your Case) | Card: "The AI's having a moment. We'll keep your argument — try again in a minute." |
| Content blocked by rating | Player or display receives content above the room's rating filter | This shouldn't appear if filtering works server-side, but as insurance: card "This content was filtered out. Skipping..." with 2s auto-dismiss |

### 8.4 Reconnecting / recovery states

| Screen | Treatment |
|---|---|
| Player phone lost connection | Banner: "Reconnecting..." in Sun Yellow at top, faded screen behind. Auto-dismiss on reconnect with a "You're back" toast in Action Green. |
| Player phone won't reconnect | After 30s: card "We can't reach the room. Check your connection." + "Try again" primary |
| Display lost connection | Banner across top of display: "Reconnecting..." with a soft pulse |
| Game state recovering | Brief overlay (1.5s): "Catching up..." with a state-rebuild indicator |

### 8.5 In-progress states for missing backend

These are the "in case API isn't ready" states. Build them so the UI doesn't break if the backend is silent:

| Screen | Treatment |
|---|---|
| Awaiting AI verdict | Same as 8.2 — placeholder with "Usually 6–10 seconds" copy |
| Awaiting validation verdict | Inline spinner replacing the submit button briefly |
| Awaiting other players to submit | "Waiting for others..." with player check-in indicator (mock: shows X/N submitted) |
| Awaiting host action | "Waiting for the host..." with a soft pulse on the indicator |

### 8.6 Stage-frame transitions

Every transition between screens that involves entering the product (joining a room, starting a game, advancing in a league) gets the stage-cobalt curtain wipe (350ms). Build a `<StageFrameTransition>` wrapper component that handles this.

---

# LAYER 2 — PER-GAME SCREENS

Each game has at least three screens to define:

1. **Catalogue tile** — the marketing+catalogue card (single source of truth; reused on landing page §1.1 and host catalogue §3.1)
2. **Configure** — the per-game config groups slotted into the §4.1 configure shell
3. **In-game** — the centre-card content slotted into the §5 in-game shells (display, host, player views)
4. **Post-game** — the celebration card slotted into the §6 post-game shell

Some games have additional unique screens noted in their section.

The format for each game:

- **Catalogue tile:** category, colour, emoji/icon, name, player range, duration, one-line description.
- **Configure screen:** list of config groups with their specific fields.
- **Preview rail:** what the right-rail shows live.
- **In-game · display:** the centre card content on display.
- **In-game · host phone:** compact status + host-play input if host is playing.
- **In-game · player phone:** input area (active state) and waiting state.
- **Post-game celebration card:** the winner-moment card layout.

---

## §9. Quizzes (#01)

**Catalogue tile:**
- Category: Quick & Casual · colour: Action Green
- Icon: 🧠 (brain)
- "Quizzes" · 2–10 · 8 min · "Multiple-choice trivia. Faster correct answers earn more points."

**Configure groups:**
- **Round** — Round count (stepper, default 10), Time per question (stepper seconds, default 20), Time limit for whole game (toggle on/off, default off; if on, stepper minutes).
- **Difficulty & content** — Difficulty (Easy/Mixed/Hard/Mixed pills), Content category (dropdown: General / Nigerian / Pop Culture / History / Sports / Sciences / Custom).
- **Scoring** — Scoring mode (Time-weighted / Flat / Custom pill toggle), Wrong-answer penalty (toggle off / −50% pill), Leaderboard cadence (Every round / Every 5 / Only at end dropdown).
- **Custom content** — Optional "Custom deck" opener (§4.3).

**Preview rail:** "Estimated duration: ~8 min · Questions: 10 · Top possible score: ~1,500."

**In-game · display:**
- Round indicator small top-left ("Q 4 / 10"), timer top-right ("0:14").
- Question text in Fraunces large, centred.
- 4 option cards beneath, lettered A/B/C/D, each in white with a coloured letter badge.
- Below: player check-in indicator (4 dots; filled as players answer).

**In-game · host phone (when host is playing):**
- Status card: "Question 4 of 10 · 0:14 left."
- Input area: 4 option buttons (A/B/C/D), large, each on its own row.
- After answer: button locks to green with checkmark, others fade to 0.5.

**In-game · player phone:**
- Same as host's input area. After submit: "Answer locked in" message with score-pending state.

**Reveal state (between questions, display):**
- Correct option pulses Action Green; incorrect options fade to 0.4.
- Score increment animation per player: "+150" floats up from each player's avatar in their row beneath.

**Post-game celebration card:**
- "Top scorer · [name]" winner bar (orange).
- Beneath winner bar: "Most accurate · [name] · 8/10" stat + "Fastest correct · [name] · avg 3.2s" stat.
- Then ranked leaderboard rows.

---

## §10. Bible Quiz (#02)

**Catalogue tile:**
- Quick & Casual · Action Green · 📖
- "Bible Quiz" · 2–10 · 8 min · "Scripture trivia with translation and testament filters."

**Configure groups:**
- **Round** — same as Quizzes but Time per question default 25.
- **Content** — Translation focus (Mixed / KJV / NIV / NLT / Yoruba / Igbo / Hausa pill toggle), Testament (Both / Old / New pills), Difficulty (Mixed / Sunday School / Intermediate / Scholar pills).
- **Custom content** — opener.

**Preview rail:** same shape as Quizzes.

**In-game:** identical layout to Quizzes; only content differs.

**Post-game celebration card:**
- Same as Quizzes but the "stat row" adds "Strongest book · [name] · Psalms (4 right)" — flavour stat unique to Bible Quiz.

---

## §11. Spelling Fast (#03)

**Catalogue tile:**
- Quick & Casual · Action Green · 🔤
- "Spelling Fast" · 2–12 · 6 min · "A word is read aloud — never shown. Race to spell it."

**Configure groups:**
- **Round** — Round count (default 15), Time per word (default 15s), Audio replays allowed (stepper, default 1).
- **Difficulty & content** — Difficulty (Beginner / Intermediate / Advanced / Spelling Bee pills), Word category (General / Nigerian English / Yoruba loanwords / Scientific / Geographic / Custom dropdown).
- **Audio** — Voice (Nigerian English / British / American dropdown), Replay allowed (toggle).
- **Anti-cheat** — Allow autocorrect (toggle, default OFF — strong note: "Auto-corrected answers are disqualified").

**Preview rail:** "Estimated duration: ~6 min · Words: 15 · Voice: Nigerian English."

**In-game · display:**
- **The word is never shown.** Centre card has:
  - "Listen carefully" eyebrow.
  - Large speaker icon centred, pulsing during playback.
  - "Word 4 of 15" indicator.
  - Replay button: "🔁 Replay (1 left)" — only shows if replays remain.
  - Timer beneath.
- After each round, the correct spelling is revealed in large Fraunces with the answer pulsing green.

**In-game · player phone:**
- "Type what you heard" instruction.
- Single text input, monospace, auto-focus on screen open.
- "Submit" primary button beneath.
- Helper text: "Autocorrect is OFF. Spell it exactly."

**Post-game celebration card:**
- Same shape as Quizzes. Additional stat: "Trickiest word · 'Onomatopoeia' (only 1 correct)."

---

## §12. Typing Fast (#04)

**Catalogue tile:**
- Quick & Casual · Action Green · ⌨️
- "Typing Fast" · 2–12 · 6 min · "A passage appears. Race to type it accurately."

**Configure groups:**
- **Round** — Passage count (default 5), Time per passage (default 60s).
- **Difficulty & content** — Passage length (Short / Medium / Long / Mixed pills), Passage source (General English / Nigerian literature / Bible / Pidgin / Famous quotes / Custom dropdown).
- **Scoring** — Accuracy weight slider (Pure speed ↔ Pure accuracy, default 50/50).

**In-game · display:**
- "Type this passage" eyebrow.
- Passage in large Fraunces, centred. As any player types, their progress shows beneath as a faint progress bar.
- Timer top-right.
- 4 progress bars beneath (one per player), each showing typed-character progress with avatar prefix.

**In-game · player phone:**
- The passage shown at top in smaller text.
- Large text input beneath with monospace font, single-line scroll.
- As the player types, characters they type that match the passage turn Forest Ink; characters that don't match turn Tomato Red.
- "Submit" button enabled once they reach the end.

**Post-game celebration card:**
- "Fastest typist · [name] · 87 WPM · 98% accuracy."
- Ranked leaderboard by composite score.

---

## §13. Wordshot (#05)

**Catalogue tile:**
- Quick & Casual · Action Green · 🎯
- "Wordshot" · 2–10 · 7 min · "A letter and a category. Type a real answer that fits — fast."

**Configure groups:**
- **Round** — Round count (default 10), Time per round (default 15s).
- **Categories** — Enabled categories (multi-select toggle group: Names / Foods / Cities / Countries / Animals / Movies / Yoruba foods / Nollywood / Naija slang / Custom). Default: first 5 enabled.
- **Difficulty** — Letter difficulty (Common only / Includes Q-X-Z / Mixed pills).
- **Duplicates** — Duplicate handling (Strict / Relaxed / Synonym-tolerant pills).
- **Content rating** — Family / Friends / Spicy / 18+ multi-select.

**Preview rail:** "Estimated duration: ~7 min · Rounds: 10 · Categories enabled: 5."

**In-game · display:**
- Centre card: large letter badge (Accent Orange circle with Fraunces letter) above a category pill (e.g., "Foods").
- Timer top-right.
- Beneath: live submission feed — as players submit valid answers, they appear as Action Green pills sliding in from the right. Invalid submissions don't appear publicly.
- Player check-in indicator beneath.

**In-game · player phone:**
- "Letter: A · Foods" status.
- Large text input.
- "Submit" primary button.
- After submit: if valid, shows in green "Got it — 320 pts" pill. If invalid, brief Tomato Red flash + "Not a match — try again."

**Post-game celebration card:**
- "Fastest fingers · [name] · 8/10 correct."
- Leaderboard with badges: "🎯 Sniper" (most-correct), "⚡ Speedster" (avg-time).

---

## §14. Word Bomb (#06)

**Catalogue tile:**
- Quick & Casual · Action Green · 💣
- "Word Bomb" · 3–10 · 7 min · "A ticking bomb passes round-robin. Hold it longer for more points."

**Configure groups:**
- **Round** — Round count (Best of 1 / 3 / 5 pills, default 3), Bomb start time (stepper, default 7s), Bomb decay (Fixed / Decay toggle, default Decay — note: "7→5→4 across rounds").
- **Categories** — Category mix (multi-select), Custom categories opener.
- **Difficulty** — Letter difficulty pills.
- **Duplicates** — Duplicate handling pills.

**Preview rail:** Live shows: "Estimated duration: ~8 min · First bomb: 07s · Eliminations available: 9 lives · Estimated words: ~60."

**In-game · display (locked, from previous design):**
- Single centred card with:
  - "06 · Word Bomb" top-left, "Round 2 · 3 left" top-right.
  - "Foods · A" category pill (Accent Orange) centred near top.
  - **Massive red Fraunces numeral** (the bomb countdown).
  - "Tobi's turn" Fraunces beneath the numeral.
  - "Already said" row beneath: pills for words played (amala, akara, apple); eliminated words struck-through in Tomato Red.

**In-game · player phone:**
- **Active (your turn):** "It's your turn — go!" headline, large text input, "Submit" primary.
- **Waiting:** "Tobi has the bomb · 04s left" with bomb icon throbbing.
- **Eliminated:** "Out of this round" tag with "Watch the rest" subhead.

**Post-game celebration card (locked):**
- Orange winner bar with Ada · 1,420.
- Ranked leaderboard hairline-divided.

---

## §15. Scrambled Word (#07)

**Catalogue tile:**
- Quick & Casual · Action Green · 🔀
- "Scrambled Word" · 2–10 · 7 min · "Unscramble the word. Guesses rank live by closeness."

**Configure groups:**
- **Round** — Word count (default 10), Time per word (default 20s).
- **Difficulty** — Word length range (5–8 / 6–10 / 8–12 / Mixed pills), Hint mode (None / First letter at half time / Progressive reveal pills).
- **Display** — Ranking display count (Top 3 / Top 5 / Top 10 pills).
- **Scoring** — Scoring weight slider (Speed ↔ Closeness, default 50/50).

**In-game · display:**
- Centre card: scrambled word in giant Fraunces, letters spaced out (e.g., "T O A M A").
- Beneath: "Top 5 guesses · ranked live" label, then ranked rows showing player guesses with closeness scores ("amala · 98%," "amale · 76%," etc.).
- Timer top-right.

**In-game · player phone:**
- The scrambled word at top.
- Text input + Submit.
- After submit: "Submitted: amala · ranked 1st" feedback.
- Player can re-submit until time runs out — only their best guess counts.

**Reveal state:**
- Answer revealed in large Fraunces centred ("AMALA").
- Players ranked by closeness; closest correct wins.

**Post-game celebration card:**
- "Closest guesser · [name] · 100% match."
- Leaderboard.

---

## §16. Missing Letters (#08)

**Catalogue tile:**
- Quick & Casual · Action Green · 🔠
- "Missing Letters" · 2–10 · 6 min · "Fill the gaps in the word. Faster correct earns more."

**Configure groups:**
- **Round** — Word count, time per word.
- **Difficulty** — Word length range, Number of letters hidden (stepper, default 3), Hint mode.

**In-game · display:**
- Centre card: word with gaps in giant Fraunces (e.g., "B _ N _ N _").
- Timer top-right.
- Player check-in indicator.

**In-game · player phone:**
- Word shown with gaps.
- Single text input (mobile auto-suggests off, monospace).
- Submit button.

**Post-game celebration card:**
- "Fastest filler · [name] · avg 4.1s per word."
- Leaderboard.

---

## §17. Definition Race (#09)

**Catalogue tile:**
- Quick & Casual · Action Green · 📚
- "Definition Race" · 2–10 · 7 min · "A definition appears. Race to name the word, ranked live."

**Configure groups:**
- **Round** — Round count, time per round.
- **Difficulty** — Word obscurity (Common / Academic / Mixed pills).
- **Display** — Ranking display count.

**In-game · display:**
- Centre card: definition in Fraunces medium, italicised (e.g., *"A traditional Yoruba dish made from yam flour, served with stew."*).
- Beneath: live-ranked closest guesses (same pattern as Scrambled Word).

**In-game · player phone:**
- Definition shown at top.
- Text input + Submit.

**Post-game celebration card:**
- "Sharpest vocab · [name] · 9/10 correct."
- Leaderboard.

---

## §18. Synonyms (#10)

**Catalogue tile:**
- Quick & Casual · Action Green · 🔗
- "Synonyms" · 2–10 · 6 min · "Type a valid synonym. Rarer answers score higher."

**Configure groups:**
- **Round** — Round count, time per round, Synonyms required per round (stepper, default 1).
- **Difficulty** — Word obscurity pills.
- **Duplicates** — Duplicate handling pills.

**In-game · display:**
- Centre card: target word in giant Fraunces.
- "Synonyms" label beneath.
- Live submission feed: valid synonyms appear as Action Green pills; rarer ones get a "✨" badge.

**In-game · player phone:**
- Target word at top.
- Text input + Submit.
- Submit allows multiple submissions per round (up to configured count).

**Post-game celebration card:**
- "Widest vocabulary · [name] · 14 valid synonyms."
- Leaderboard.

---

## §19. Antonyms (#11)

Same as Synonyms but inverted semantics. Catalogue tile uses ↔️.

---

## §20. Who Wants to Be a Millionaire (#12)

**Catalogue tile:**
- Brain & Strategy · Stage Cobalt · 💰
- "Who Wants to Be a Millionaire" · 2–10 · 15 min · "A graduated ladder, taken in turns. Lifelines included. Bank the most."

**Configure groups:**
- **Mode** — Turn mode (Rotational / Solo-full-ladder / Lightning-buzzer pills, default Rotational).
- **Game length** — Length mode (Time / Question count / Ladder pills, default Time), Time per game (default 15 min), Time per question (default 30s).
- **Difficulty** — Difficulty curve (Standard / Flat / Easy / Hard pills).
- **Lifelines** — Multi-select: 50/50, Ask the Audience, Phone a Friend (all default on).
- **Money** — Currency display (₦ ladder / $ ladder / Points pills).

**Preview rail:** "Estimated duration: 15 min · Lifelines active: 3 · Top win: ₦10M."

**In-game · display:**
- Centre card: question top, 4 option cards in 2×2 grid with letters.
- **Money ladder strip** running down the right side: 15 rungs from ₦1,000 to ₦10M with the current rung highlighted in Action Green and "safe haven" rungs (₦100k, ₦1M) marked.
- Hot-seat player name top-left ("Tobi in the seat").
- Lifelines remaining as icons row.

**In-game · host phone:**
- Compact: question + options + ladder strip miniaturised.
- Host controls.

**In-game · player phone (hot-seat player):**
- Question + 4 option buttons stacked.
- Lifelines as 3 buttons beneath: 50/50, Ask the Audience (taps the room for a poll), Phone a Friend (assigns to a chosen player who gets 15s to advise).
- "Walk away with [current safe amount]" ghost button.

**In-game · player phone (audience):**
- "Watching · Tobi has [current rung]."
- If Ask the Audience triggered: poll UI appears ("Vote what you think the answer is" — 4 buttons).
- If Phone a Friend assigned to you: "You've been called! Help Tobi answer..." with the question + 15s timer + advice text input.

**Lifeline screens:**
- **50/50 result:** two options fade to 0.3, only the correct + one wrong remain.
- **Ask the Audience result:** bar chart appears beneath options showing % vote per option.
- **Phone a Friend result:** chosen player's text advice appears in a card overlay with their avatar.

**Post-game celebration card:**
- "Banker · [name] · ₦1,000,000 banked."
- Plus a "ladder rungs reached" stat per player.
- Leaderboard by banked amount.

---

## §21. Truth or Dare (#13)

**Catalogue tile:**
- Party & Social · Berry Purple · 🎲
- "Truth or Dare" · 2–12 · 10 min · "Pick truth or dare. The room votes on whether you delivered."

**Configure groups:**
- **Round** — Round count (full round-robins, default 2), Time per turn (truth default 45s, dare default 90s — paired stepper).
- **Voting** — Voting threshold (Majority / Unanimous / Any one pills).
- **Content rating** — Multi-select: Family / Friends / Spicy / 18+.
- **Content tags** — Multi-select exclusions: Sexual / Religious / Political / Physical / Personal / Relationship.
- **Skips** — Skip allowance (stepper, default 1 per player).
- **Custom prompts** — opener.

**In-game · display:**
- Centre card: player's avatar large at top, "[Name]'s turn" Fraunces.
- Two big tiles beneath (player's choice mirrored from their phone): TRUTH or DARE highlighted depending on choice.
- Once chosen, the prompt text appears in Fraunces large.
- Timer.
- Voting state (after timer or skip): "Did Tobi deliver?" with vote tally bars.

**In-game · player phone (active player):**
- "Your turn" headline.
- Two large tiles: "TRUTH" and "DARE." Tap to choose.
- Once chosen, prompt shown + "Done" and "Skip (1 left)" buttons.

**In-game · player phone (others):**
- "Tobi picked TRUTH. Watch them deliver."
- Once active player finishes, voting buttons appear: "✅ Delivered" / "❌ Didn't."

**Post-game celebration card:**
- "Best dare · [name] · 'Sing the national anthem in falsetto.'"
- "Best truth · [name] · 'I once stole jollof from my aunt's pot.'"
- Standard leaderboard.

---

## §22. Catch the Lie (#14)

**Catalogue tile:**
- Party & Social · Berry Purple · 🤥
- "Catch the Lie" · 3–10 · 10 min · "Two truths and a lie, revealed anonymously. Spot the fib."

**Configure groups:**
- **Round** — Submission time (default 120s), Voting time per reveal (default 30s).
- **Theme** — Theme constraint (Open / Childhood / Travel / Work / Embarrassing / Custom pills).
- **Scoring** — Scoring weights slider (Correct guess ↔ Fooling people).

**In-game · display (submission phase):**
- Centre card: "Write two truths and a lie about yourself" instruction.
- 4 player check-in indicators beneath ("Submitting...").

**In-game · display (reveal phase):**
- Centre card: 3 statements stacked in Fraunces medium, numbered 1/2/3. No author shown.
- Beneath: voting tally bars (live as players vote).

**In-game · player phone (submission):**
- 3 text inputs: "Truth 1," "Truth 2," "Your lie." Submit when all filled.

**In-game · player phone (voting):**
- 3 statements shown. Tap one to vote. After tap: "Locked in" state.

**Reveal animation:**
- The lie is revealed: the lie-statement card pulses Accent Orange + the author's name appears beneath ("Tobi's lie").

**Post-game celebration card:**
- "Best deceiver · [name] · fooled 4 out of 5 players."
- "Sharpest eye · [name] · caught 5 lies."
- Leaderboard.

---

## §23. Hot Take Court (#16)

**Catalogue tile:**
- Party & Social · Berry Purple · 🔥
- "Hot Take Court" · 3–15 · 10 min · "A spicy prompt. Defend it in one sentence. The room votes the winner."

**Configure groups:**
- **Round** — Prompt count (default 5), Submission time (default 60s), Voting time (default 45s).
- **Content** — Prompt category (Mixed Nigerian / Food debates / Lagos vs Abuja / Relationships / Pop Culture / Religion-lite / Custom dropdown).
- **Content rating** — multi-select.
- **Bonus** — Funniest-defence bonus round (toggle, default on).

**In-game · display (submission):**
- Centre card: prompt in Fraunces large + "Defend your position in one sentence."
- Submission timer + player check-in indicator.

**In-game · display (voting):**
- All defences appear stacked, anonymous, in Fraunces italic with quotation marks.
- Beneath each: vote count chip (live).

**In-game · player phone (submission):**
- Prompt shown. Single-line text input. Character counter (180 max).
- Submit.

**In-game · player phone (voting):**
- Defences shown stacked. Tap one to vote for most convincing.
- If bonus round: second screen voting for funniest.

**Reveal:**
- Winning defence pulses Accent Orange, author revealed beneath.

**Post-game celebration card:**
- "Most convincing · [name] · 'Suya is overrated unless made by a Hausa man over open flame.'"
- "Funniest · [name] · 'Jollof rice rivalries are how Nigerians do diplomacy.'"
- Leaderboard.

---

## §24. Investigation (#17)

**Catalogue tile:**
- Immersive · Forest Ink · 🔍
- "Investigation" · 2–8 · 30 min · "Work the case from your phone, then name who is responsible."

**Configure groups:**
- **Case** — Case selection (browse pre-built cases as a card list — mock 6 cases with titles, severity tags, runtime estimates).
- **Time** — Case duration (15 / 30 / 45 / 60 min pills).
- **Difficulty** — Number of suspects (3–6 stepper), Red herring intensity (Light / Medium / Heavy pills).
- **Collaboration** — Communication mode (Solo / Allow notes between players pills).

**In-game · display:**
- Centre card: case title in Fraunces ("The Catered Wedding · Suspected Poisoning"), short premise (3 sentences).
- Suspects strip beneath: 4 avatar cards in a row, each tappable on the display only as a visual reference (real interaction on phones).
- Timer prominent.
- Below: "Players investigating · 4" indicator.

**In-game · player phone (investigation phase):**
- Tab bar: Case · Suspects · Evidence · Transcripts · My Notes.
- **Case tab:** the full premise + timeline of events.
- **Suspects tab:** 4 suspect cards with profiles (name, relation, alibi, motive).
- **Evidence tab:** list of evidence items (each opens a detail view with description + photo placeholder).
- **Transcripts tab:** interview transcripts as readable scrollable text.
- **My Notes tab:** private notebook for the player.
- Floating "Make accusation" button bottom-right, visible only after 50% of case time has elapsed.

**Accusation screen (player phone):**
- Suspect cards as selectable list.
- Confidence slider: "How sure are you? (1–5 stars)."
- Reasoning text input.
- Submit.

**In-game · display (post-time):**
- "Everyone has accused. Revealing the truth..." with anticipation animation (3s build).
- Then: the real culprit's avatar enlarges, name in Fraunces, with a short "the truth" narrative card.
- Correct accusers light up in Action Green; incorrect in Tomato Red.

**Post-game celebration card:**
- Stage Cobalt frame with "Case Closed" title.
- Culprit reveal card with avatar + name + 1-sentence true narrative.
- "Top detective · [name] · correct + fastest" winner bar.
- Leaderboard with per-player rationale snippets shown beneath their score.

---

## §25. Plead Your Case (#18)

**Catalogue tile:**
- Immersive · Forest Ink · ⚖️
- "Plead Your Case" · 2–10 · 12 min · "Argue the defence. An AI scores soundness, persuasion, and precedent."

**Configure groups (locked from earlier design):**
- **Round** — Argument time (3 / 5 / 10 min pills), Charge severity (Minor / Mixed / Major pills).
- **AI evaluation** — Criterion weight sliders for Legal soundness, Persuasiveness, Use of precedent (must sum to 100 — auto-redistribute).
- **Feedback** — Show AI feedback to losers (toggle, default on).
- **Content** — Case selection (browse pre-built cases).
- **Custom content** — opener.

**Preview rail (locked):** Sample argument + sample verdict (the "C4" treatment).

**In-game · display:**
- Centre card: "Verdict pending" eyebrow.
- Case summary: charge in Fraunces ("Contract Dispute · Clause 3.b breach"), defendant, facts (3 bullets), applicable laws (2-3 items).
- Players' submission status: 4 dots, filled as players submit.

**In-game · player phone (argument phase):**
- Case facts at top (scrollable).
- Large text area for argument (character counter, mock-recommended length).
- Timer.
- "Submit defence" primary.

**Awaiting AI verdict (display + player):**
- Overlay: "The AI is reading the arguments..." with a dignified Fraunces spinner + "Usually 6–10 seconds" subtext.

**Post-game celebration card (locked):**
- Three-layer stack:
  1. **Winning argument** card — Accent-soft block with Fraunces italic quote + author + meta ("5 min · 1 precedent cited").
  2. **AI verdict** block — Deep Forest Ink background with "84/100 · Acquitted" Fraunces hero + 2-sentence rationale.
  3. **Per-criterion rubric strip** — Legal soundness 44/50, Persuasiveness 25/30, Precedent 15/20 with progress bars.
- Standard orange winner bar + leaderboard beneath.

---

## §26. Presentation (#19)

**Catalogue tile:**
- Immersive · Forest Ink · 🎤
- "Presentation" · 2–10 · 12 min · "Present a cold topic for 90 seconds. The room rates you."

**Configure groups:**
- **Round** — Presentation duration per player (default 90s).
- **Topics** — Topic category (Nigerian debates / Pop culture / Philosophy / Spicy / Custom pills), Reveal early (toggle off — pure cold open by default, on = topic shown 5s before).
- **Rating** — Rating criteria enabled (multi-select: Persuasiveness, Entertainment, Confidence).
- **Bonus** — Heckle questions allowed (toggle, default on), Audience-favourite bonus (toggle, default on).
- **Content rating** — multi-select.

**In-game · display (active player presenting):**
- Centre card: presenter avatar large at top, "[Name] is presenting" Fraunces.
- Their topic in Fraunces large beneath ("Money makes love easier.").
- 90-second timer prominent.
- Below: live heckle questions feed (when enabled).

**In-game · player phone (presenter):**
- Their topic shown at top.
- Timer.
- "I'm done early" button (skips remaining time).
- That's it — they're presenting verbally.

**In-game · player phone (audience):**
- "Tobi is presenting" status.
- Rating sliders during presentation (Persuasiveness, Entertainment, Confidence) — locked until presentation ends.
- "Submit a heckle question" text input (single-line, locked to 1 per presentation).

**Voting phase (after each presentation):**
- All sliders unlock. Submit ratings.
- Heckle questions list shown — vote for "best heckle."

**Post-game celebration card:**
- "Best presenter · [name] · avg 4.7/5."
- Top heckle question card: "[Question text]" with asker credit.
- Per-criterion top scorer mini-stats.
- Leaderboard.

---

# END OF SPEC

**Total screen surface:**

- Universal screens (Layer 1): ~45 distinct screens across 3 device contexts.
- Per-game screens (Layer 2): 18 games × ~5–8 screens each = ~120 game-specific screen states.
- **Total: roughly 165 screen states.**

All screens use the locked design system (Canvas Mint, Stage Cobalt, Action Green, Accent Orange, Forest Ink, Fraunces + Nunito, layered cards, no shadows, snappy motion). All copy follows the locked voice. All mock state uses Tobi/Ada/Funmi/Kemi and room code `GBE-4ZK`.

Build with feature-sliced design: each game lives in its own feature slice with `configure/`, `display/`, `host/`, `player/`, `result/` directories. Universal screens live in shared `widgets/` and `pages/` layers. The `<StageFrameTransition>`, `<RoomCodeChip>`, `<PlayerPill>`, `<OrangeWinnerBar>`, `<LeaderboardRows>`, and `<PreviewRail>` should be shared components.

When the API arrives, replace `useState` mock state with real data sources. The UI shouldn't need redesign — only data wiring.