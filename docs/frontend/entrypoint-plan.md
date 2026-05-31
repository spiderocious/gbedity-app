# Tech Spec — Landing Page (`/` route)

> Status: **REV 1 BUILT & APPROVED. REV 2 (energy overhaul) APPROVED — building.**
> Scope: bare presentational UI only. No API, no WebSocket, no room logic, no real
> hooks. Static mock data + local `useState` purely to demonstrate visual states.
> Logic/API is the deferred layer wired in once the backend lands.
>
> **Rev 2 = the "make it feel like a party" pass.** The structure (rev 1) is right;
> the energy was missing — page read like documentation for a party, not the party.
> See §10 below for the full rev-2 spec and decisions.

---

## 1. What the landing page is (grounded in the PRD)

`/` is the **single entry funnel for both roles** from one screen:

- **Host** creates a room from the landing page → gets a 6-char code
  (PRD §4: "A user creates a room from the landing page").
- **Player** joins by entering the room code (or scanning a QR) → nickname
  (PRD §10 join flow).
- The catalogue spans **18 games** across 4 categories (PRD §6 — Sketch & Guess #15
  is **skipped for now** per the marked PRD). The landing page is where the product's
  *breadth* and *Nigerian-coded distinctiveness* land emotionally (PRD §1 wedge).
- Brand stance: "looks like a party from the first frame" (branding §1) — `/` is that
  first frame.

So `/` must serve **two intents in one view** — *"I'm hosting, start a room"* and
*"I'm joining a friend's room"* — and communicate *what the product is* (the games).

Current state: `features/landing/landing-screen.tsx` is a placeholder stub (logo + one
line + Play button + `/preview` link). This plan replaces it with a real feature.
`app.tsx` already mounts `BannerHost / ModalHost / ToastHost`, so `DrawerService` is
available app-wide.

---

## 2. Sections (what should be on the page)

Requested elements folded in: **join-code input, games, create game, quick play,
league play.**

| # | Section | Why | Built from `@gbedity/ui` |
|---|---------|-----|--------------------------|
| **A** | **Top bar** — Logo · "How it works" ghost link · small dev "Component preview" link | Brand presence; preserve the existing `/preview` link | `Row`, new `Logo` (see §5), `Button` ghost |
| **B** | **Hero** — Fraunces headline + one-line subhead, on Stage→Canvas layering | "Party from the first frame" — sets the register | `Row/Column`, brand type tokens |
| **C** | **Two primary entry cards** — **Join a room** and **Host a room**, equal weight | The two core intents | `Card`, `RoomCodeInput`, `Field`, `Button` |
| **D** | **Host paths** (inside the Host card) — **Quick Play**, **Create Game**, **League Play** | Requested create/quick/league. Quick Play = pick-a-game-and-go (single-game defaults, the <30s path, PRD §2/§9); Create Game = full configurator; League Play = multi-game queue (PRD §4/§7.3) | `Button` variants / small choice list |
| **E** | **Games showcase** — category filter chips + grid of `GameTile`s (18 games) | Communicates breadth + Nigerian content; lets a visitor browse before committing (PRD §6) | `CategoryChip`, `GameTile`, `Row/Column` |
| **F** | **"How it works" strip** — 3 steps: open on TV · scan/code on phone · play | Removes first-timer friction (PRD §1, §5) | `Card`/`Row`, numerals |
| **G** | **Footer** — free-to-use note · Pidgin/English hint · dev `/preview` link | Brand tone; honest "Free to use" (PRD §2) | `Row` |

### Join card (C, join half) detail
- `RoomCodeInput` (the 6-char joiner already in the library) + primary **Join** button.
- "Scan QR instead" affordance (visual only — no camera logic this pass).
- Nickname is **not** collected here — per PRD §10 the flow is code → *then* nickname.
  Landing only captures/initiates the code; nickname is a downstream screen. (Open
  question O1 below.)

### Host card (C+D, host half) detail
- Three paths as the host's launch choices:
  - **Quick Play** — primary action (Action Green). Fastest path.
  - **Create Game** — secondary.
  - **League Play** — ghost/secondary, tagged with a Berry-Purple `Pill` (brand: league
    accent is Berry Purple).
- All three navigate to placeholder routes (`/host?...`) or fire a
  `DrawerService.toast('Coming soon')` until those features exist. **No room is created.**

---

## 3. File structure (FSD, production layout now)

Screen reads like a table of contents; parts do the work; nothing over ~200 lines.
Replaces the placeholder file.

```
apps/game/src/features/landing/
├── screen/
│   ├── landing-screen.tsx              # composition root — composes parts only
│   └── parts/
│       ├── landing-top-bar.tsx         # A
│       ├── landing-hero.tsx            # B
│       ├── join-room-card.tsx          # C — join half
│       ├── host-room-card.tsx          # C+D — host half (quick/create/league)
│       ├── games-showcase.tsx          # E — chips + GameTile grid
│       ├── how-it-works.tsx            # F
│       └── landing-footer.tsx          # G
├── shared/
│   └── games-manifest.ts               # static 18-game catalogue (as const POJO)
└── landing.routes.tsx                  # `/` route (lazy)
```

- `landing.routes.tsx` exports the `/` route; `app.routes.tsx` imports it (mirrors the
  existing `previewRoute` pattern) so the route definition lives with its feature.
- `games-manifest.ts` is the single source for the showcase — **no fetch**. When the
  backend exists, this becomes the shape the catalogue API returns; the showcase reads
  the same type, so wiring is a drop-in swap.

---

## 4. Data & state (bare-UI rule)

- **Games manifest** — `as const` POJO. Per the no-inline-variant-strings rule, the game
  *keys* and *categories* are named constants with derived union types, never inline
  literals:

  ```ts
  export const GameCategory = {
    CASUAL: 'casual',
    BRAIN: 'brain',
    PARTY: 'party',
    IMMERSIVE: 'immersive',
  } as const;
  export type GameCategory = (typeof GameCategory)[keyof typeof GameCategory];

  export const GameKey = {
    QUIZZES: 'quizzes',
    BIBLE_QUIZ: 'bible-quiz',
    // … 18 total, Sketch & Guess excluded
  } as const;
  export type GameKey = (typeof GameKey)[keyof typeof GameKey];

  export interface LandingGame {
    readonly id: number;          // 1–19 (matches PRD numbering; #15 skipped)
    readonly key: GameKey;
    readonly category: GameCategory;
    readonly tag: string;         // "Quick", "Brain", "Party", "Immersive"
    readonly title: string;
    readonly meta: string;        // "2–10 · 8m"
    readonly description: string;
  }
  ```

- **Local state, demo-only:**
  - `activeCategory: GameCategory | 'all'` — the showcase filter (visual only).
  - `roomCode: string` — controlled value for `RoomCodeInput` (no validation/submit logic;
    Join button is visually live but inert / toasts).
- **No** providers, guards, api/ folders in this feature this pass — none are needed yet,
  and per no-known-gaps I won't add empty fake-plumbing seams. They get added when the
  join/host features are built with real logic.

---

## 5. New `@gbedity/ui` components proposed (plan-first, before any code)

Per "reuse, never reinvent": the page is ~90% composable from existing primitives
(`Card`, `Button`, `RoomCodeInput`, `Field`, `CategoryChip`, `GameTile`, `Pill`,
`Row`, `Column`, `GameAvatar`). **One** genuine gap I'd add to the library rather than
hand-roll inline — its own approved sub-plan before writing:

1. **`Logo`** — the wordmark/brand mark as a standalone component (brand + frontend
   persona both require the logo be its own reusable component). Sizes `sm|md|lg`,
   `variant: full|mark`. Renders "Gbedity" as a Fraunces wordmark in Forest Ink now;
   swaps to an SVG mark later via the same component. Used in the top bar now; header /
   loading / auth screens later.

`StageFrame` is **not** in this pass (O2 → flat Canvas). It gets designed when a screen
that needs the Stage Cobalt poster-frame (display / post-game) is built.

---

## 6. Brand & quality bar (production-grade, this pass)

- Stage→Canvas→Card layering; depth from colour, not shadows.
- Fraunces for hero/headline + numerals; Nunito for all operational UI.
- Action Green for the primary host action; Accent Orange reserved for celebration only
  (so the hero does **not** lean on orange as a generic accent); Berry Purple tags League.
- 8px grid via `Row/Column` `gap` tokens; generous padding; nothing cramped.
- Voice: confident host, **no exclamation marks in chrome**; empty/secondary copy has
  personality ("Quiet in here…" register).
- Responsive: mobile-first (host/player are phones); the two entry cards stack on small
  screens, sit side-by-side ≥ md; the games grid is 1-up → 2-up → 3-up.
- A11y: semantic landmarks (`header/main/footer/nav`), labelled `RoomCodeInput`, 44px
  touch targets, WCAG AA contrast (Forest Ink ~10:1), colour never the sole signal.
- Reduced motion: any hover lift / entrance respects `prefers-reduced-motion`.
- meemaw `<Show>/<Repeat>` for the showcase grid + conditional bits (app-layer; the UI
  package stays meemaw-free).

---

## 7. Out of scope (deferred to wiring pass)

- Real room creation, code generation, QR generation/scanning, nickname capture.
- Navigation targets for Quick Play / Create Game / League Play / Join (placeholder
  routes or `DrawerService` stubs until those features exist).
- Host account / auth.
- i18n (English + Pidgin) — copy is English now; structure won't block i18n later.

---

## 8. Verification (definition of done for this pass)

- `@gbedity/ui` and `@gbedity/game` typecheck + lint clean **for all files I touch**
  (note: the pre-existing `drawer/` typecheck failures are not mine — tracked separately).
- Renders at `/`; responsive at 360 / 768 / 1280 widths; keyboard-navigable.
- Any new `@gbedity/ui` component ships with its own test + a `/preview` gallery part.
- No inline variant strings; no known layering/quality gaps; production-grade visuals.

---

## 9. Resolved decisions

- **O1 — Nickname on landing? → Code only.** The landing Join card captures only the
  6-char code (`RoomCodeInput` + Join). Nickname is the next screen, per PRD §10
  (code → then nickname).
- **O2 — StageFrame now or later? → Flat Canvas now, extract later.** The landing sits on
  a Canvas Mint background with white cards. `StageFrame` is **dropped from this pass** and
  deferred to when display/post-game screens need it, so it's designed against real usage.
- **O3 — Games showcase depth? → All 18 tiles, filterable.** Full catalogue grid with
  `CategoryChip` filters. Communicates the breadth + Nigerian-content wedge.
- **O4 — Logo asset? → Fraunces text wordmark for now.** `Logo` renders "Gbedity" as a
  Fraunces wordmark in Forest Ink. No asset dependency; the same component swaps to an SVG
  mark later.

---

## 10. Rev 2 — the energy overhaul

Rev 1 nailed the information architecture (hero · join/host · catalogue · how-it-works ·
footer) but read like documentation for a party, not the party. Rev 2 keeps the bones and
adds the energy. **Bare-UI rule still holds** — no game logic, no API; demo motion + mock
frames only.

### 10.1 Decisions (locked)
- **Tile anchor → per-game lucide icon.** Emoji would break the persona's "lucide not
  emoji" rule and branding §5's no-kawaii stance. Each tile leads with a category-tinted
  lucide icon (Bomb, Scale, Target, Gavel, …); the catalogue number is demoted to a faint
  corner reference, not the hero element.
- **Hero demo → mock-frame montage now.** A self-contained looping panel cycling 4–6
  static "in-game moment" mocks (Word Bomb numeral, Plead verdict block, Hot Take winner
  bar, Wordshot reveal, Catch-the-Lie statements). ~3s hold, 250ms crossfade. NO game
  logic — pure presentational frames built from `@gbedity/ui`. Rewired to real in-game
  screens when those exist.
- **Motion → GSAP** (`gsap@3.15.0` + `@gsap/react@2.1.2`, pinned, added to `apps/game`).
  `useGSAP` for cleanup/StrictMode safety. Confetti stays hand-rolled (no second lib).
- **Copy → "Eighteen"** (matches 18 shipped games; Sketch & Guess skipped) + **"Made in
  Lagos"** in footer.

### 10.2 Copy (brand voice — confident host, no exclamations in chrome)
- **Hero eyebrow:** FREE · NO INSTALLS · NO ACCOUNTS
- **Hero headline:** Game night for the room.
- **Hero subhead:** Phones are the controllers. Eighteen games, from quick quizzes to
  courtroom showdowns. Open it, share a code, play.
- **Join card:** eyebrow JOIN A ROOM · "Got a code?" · "Type the six characters from the
  shared screen — or scan the QR." · label "Room code" · "Join room →" · "Scan QR instead"
- **Host card:** eyebrow HOST A ROOM · "Start the night." · "Open a room here, put it on a
  screen the room can see, share the code. Players join from their phones." ·
  **single button "Start a room →"** (Quick/Create/League move into the host flow downstream)
- **Catalogue intro:** "Eighteen ways to play." · "Quick rounds, brain-benders, party
  chaos, and full-on mystery cases."
- **Made-for-nights (NEW section):** "Made for nights like these."
  - Family game night — "Mixed ages, mixed energy. Family-rated games only — set it once,
    forget it."
  - Friends-over party — "Eight people, two pizzas, three hours. Spicier rounds for the
    grown-ups."
  - Sunday with the cousins — "Twelve cousins, one phone each. Tournament mode, one winner
    at the end."
- **How it works:** "How it works." — 01 "Open on a screen" / "Put Gbedity on any screen
  with a browser — Smart TV, laptop, or projector." · 02 "Phones join in" / "Everyone scans
  the code or types it in. No app, no sign-up, no fuss." · 03 "Play together" / "Answer,
  vote, draw, argue. The shared screen keeps score."
- **Footer:** "Gbedity · Free to play · English & Pidgin · Made in Lagos" · "Component
  preview →"

**TV references reduced to one** — only How-it-works step 01 heading ("Open on a screen"
subhead may name Smart TV as one example). Everywhere else: "the room", "the shared
screen", "the night".

### 10.3 Structural changes
- **Host card → one button.** Drop the three stacked paths; modes live in the host flow.
- **GameTile usage → lucide signature icon + demoted number.** Needs a small `@gbedity/ui`
  change OR a landing-local tile wrapper — see §10.5.
- **New section "Made for nights like these"** between catalogue and how-it-works — three
  cards, object-only illustration vibe (lucide: Sofa, Utensils/Pizza, Trophy), one line each.
- **Filter pills** already filter (rev 1); rev 2 makes the transition explicit: non-matching
  tiles fade (200ms, opacity→0.2, scale→0.95) — no layout shift / no remount.

### 10.4 Motion (GSAP + CSS, all reduced-motion gated)
- **Hero mock-montage:** crossfade loop, ~3s hold / 250ms fade; pauses on
  `prefers-reduced-motion` (shows one static frame).
- **Catalogue scroll-reveal:** GSAP ScrollTrigger, staggered fade-up + slight rise, 80ms
  stagger, fires once.
- **Tile hover:** lift 8px + soft tinted shadow + icon nudges; click scales to 1.02 before
  navigating (navigates to placeholder/toast this pass).
- **How-it-works:** step cards reveal on scroll-in (stagger).
- **Hero confetti:** ~3 hand-rolled CSS particles, fall + fade in 1.5s, **once per session**
  (sessionStorage flag), suppressed under reduced-motion.
- **Route curtain:** a Stage-Cobalt wipe component (350ms) for entering the product; built
  now, plays into a placeholder until the host route exists.
- All obey the brand budget (150–250ms; spring for celebration only; reduced-motion).

### 10.5 New / changed `@gbedity/ui` (plan-first, each its own approved sub-step)
- **`GameTile` — add optional `icon?: ReactNode` + demote the number.** The number is
  currently the tile-top hero (`opacity-55` Fraunces watermark). Rev 2: when `icon` is
  passed, the lucide icon becomes the anchor and the number shrinks to a faint corner ref.
  This is an *additive, backward-compatible* prop change — existing `GameTile` callers
  (preview gallery) keep working. Comes with updated test + preview part.
- **`CurtainTransition`** (maybe) — the Stage-Cobalt wipe. If reused by host/display later
  it belongs in the library; if landing-only for now, keep it as a landing part and extract
  later. Default: **landing part now, extract when a second caller appears** (avoids
  speculative library surface).
- Hero montage frames, "made-for-nights" cards, confetti = **landing parts**, not library
  (single-use presentational).

### 10.6 New landing files (added to the rev-1 structure)
```
features/landing/
├── screen/parts/
│   ├── hero-demo-panel.tsx        # cycling mock in-game moments
│   ├── made-for-nights.tsx        # NEW section
│   └── curtain-transition.tsx     # stage-cobalt route wipe (landing-local for now)
├── shared/
│   ├── hero-moments.ts            # as-const mock frame manifest (no logic)
│   ├── game-icons.ts              # GameKey → lucide icon map (as-const)
│   └── nights.ts                  # as-const "made for nights" manifest
└── utils/
    └── use-session-confetti.ts    # once-per-session confetti trigger (reduced-motion aware)
```
All new string sets (`hero-moments`, `nights`, icon map keys) follow the no-inline-variant
rule — `as const` POJOs, derived unions, accessed by key.

### 10.7 Out of scope (still deferred)
Real room creation / codes / QR / nickname; real in-game screens (montage uses mocks);
host mode-fork (now lives downstream); auth; i18n. Curtain plays into a placeholder.

### 10.8 Verdict being addressed
Rev 1 self-graded B− (structurally right, energetically wrong). Rev 2 targets the energy:
hero as the loudest moment, motion throughout, emoji-free signature icons, real filtering,
the "who's it for" section, and copy that sells the night — not the hardware.
