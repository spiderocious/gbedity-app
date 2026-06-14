# Solo Games Playbook — building a single-player game end to end

> **Read this once and you can build a new solo game with no further briefing.** It captures the
> mission, the rules you must obey, the architecture we chose, the design language, the exact backend
> contract, the frontend slice anatomy, and a step-by-step playbook. Missing Letters is the worked
> reference — every pattern below is implemented there. Copy it.

---

## 0. TL;DR for a new agent

You are building **one game's single-player (solo) experience** for Gbedity, a Nigerian-coded
second-screen party game. Solo = **one device, client-driven, no WebSocket**. You will:

1. Add a **thin REST backend** under `apps/backend/src/features/solo/<game>/` — an in-memory
   session that keeps answers secret and validates submissions. (Reuse the engine's pure helpers;
   do **not** use the room/socket/runtime/timer stack.)
2. Build a **self-contained frontend slice** under `apps/game/src/features/games/<game>/` — its own
   UI atoms, its own screens (built as bouncing "slides"), its own client state machine. **Do not**
   route through the shared `flow-registry` / `use-game-flow` / generic in-game screens.
3. Ship a **`/preview-ui`-style route** that renders every screen as bare UI (no logic) for design
   review, then wire the real client logic against the live backend.
4. **Typecheck + lint + test green** at every step. Self-test the backend live with curl.

Work **one screen / one step at a time**. The user reviews UI kinetically in the preview before you
wire logic. Reference implementation: **Missing Letters** (`missing_letters`).

---

## 1. The mission & product context

Gbedity is a browser-only, second-screen party game platform. Phones are controllers; a TV is the
shared display. Roles are **host / player / display**; sessions run **single-game or league**.
Strong Nigerian cultural specificity (Pidgin, local categories). The PRD lists 19 games; **#15
Sketch & Guess is explicitly SKIPPED**. Full product/PRD/branding source lives at
`/Users/feranmi/codebases/2026/dockito/projects/gbedity/{prd.md,branding.md}` — you should not need
it for a solo build, but it's the ground truth if you do.

### Why solo, and why client-driven

The multiplayer engine (room + Socket.IO + `GameRuntime` + server timers + snapshots) exists to
**synchronize many devices**. For one device that machinery is pure overhead and forces the client to
"follow" server-driven phases. **The user's explicit direction:** solo should drive its own logic —
`start → countdown → request question → submit → show round score → continue → next round` — owning
its own pacing, with the backend as a thin request/response surface. So:

- **Solo `<game>` = client-driven REST.** New, additive backend; new frontend slice.
- **Multiplayer `<game>` stays socket-driven** (the existing engine). When multiplayer is built
  later it will **reuse the slice's `ui/` atoms and pure helpers**, but NOT its solo flow logic.

### Why per-game vertical slices (not the shared flow system)

The old frontend forces every game through one stack: 3 generic screens
(`player/display/host-game-screen`) + `flow-registry` + `use-game-flow` (a 7-stage machine every game
maps onto) + `detectLiveGame`. The user wants the opposite: **each game is a distinct, self-contained
slice** — its own screens, its own logic — so it's easy to debug and fix in isolation.

**Migration strategy:** build parallel slices under `features/games/<game>/`. **Do not delete** the
old flow system; we migrate games one by one and garbage-collect the shared stack at the very end.
Other games keep working untouched while you build yours.

---

## 2. Non-negotiable rules (personas distilled)

These come from the senior backend / frontend / fullstack personas. Obey them — they are how this
codebase is reviewed.

### Backend
- **Never throw from a service for an expected failure.** Return `ServiceResult<T>`
  (`ServiceSuccess(data)` / `ServiceError(code, messageKey, httpStatus, fieldErrors?)`). Controllers
  unwrap and map through `ResponseUtil`.
- **Never `res.json()` directly** in a handler — always `ResponseUtil.{ok,created,noContent,error}`.
- **Never pass `req` into a service.** Services take typed data only.
- **Never hardcode a human string in a response.** Use a `MESSAGE_KEYS.*` key; add new keys to
  `shared/messages/keys.ts` + text to `shared/messages/index.ts`. Error codes go in
  `shared/http/error-codes.ts` and clients switch on `code`, never message text.
- **`asyncHandler`** wraps any async route handler. **Register specific routes before parameterized
  ones** (Express order: `/missing-letters/*` before `/:soloId`).
- **Never `any`** — `unknown` + narrow. Validate untrusted input (clamp config; reject bad bodies).

### Frontend
- **No `any`.** Strict TS. Validate external data at the boundary (Zod) — never trust the wire.
- **Icons only from `@icons`** (the lucide proxy). Never import `lucide-react` directly.
- **No inline variant/union string literals.** Every variant is a named `as const` POJO, and the
  union type derives from it: `const Tone = {A:'a',B:'b'} as const; type Tone = (typeof Tone)[keyof typeof Tone]`.
- **All server data through React Query** (`useMutation`/`useQuery`) — no bare `useEffect + fetch`.
- **Routes via the `ROUTES` constant** (`shared/constants/routes.ts`) — never inline path strings.
  Build paths with `pathWith(ROUTES.X, {code})`. (There is **no `EP` constant**; REST endpoint
  strings live inline inside each `shared/api/` hook — follow that pattern.)
- **`cn()`** (from `@gbedity/ui`) for conditional classes. Reuse `@gbedity/ui` — never reinvent a
  Button/Input/Card/Score/Pill/Modal/etc.
- **Prefer `<Show>` / `<Repeat>` from `meemaw`** over `&&` / `.map()` in JSX where the codebase does.
- **No known gaps shipped.** Build it right; don't leave half-wired layers.

### Process
- **Typecheck + lint at every step** (`nx typecheck game` / `nx typecheck backend`;
  `npx eslint <path> --ext .ts,.tsx`). Backend tests via **Jest** (colocated `*.test.ts`); frontend
  via **Vitest**.
- **One step at a time.** Backend first (with a live curl self-test + unit tests), then UI screen by
  screen (reviewed in `/preview-ui`), then wire logic, then end-to-end.

---

## 3. Repo orientation (what you need to know)

Monorepo: Nx + pnpm (`npm`/`yarn` blocked). Apps: `apps/backend` (Node/Express/Mongo, Jest),
`apps/game` (Vite/React/TS, Vitest). Shared: `packages/ui` (`@gbedity/ui`), `packages/icons`
(`@icons`).

- **Commands:** `nx dev backend` (port **8090**, needs Mongo + Redis), `nx dev game` (port **5173**).
  `nx typecheck <proj>`, `pnpm test`, `npx eslint <path> --ext .ts,.tsx`. Run from repo root.
- **Backend path aliases:** `@engine/* @features/* @shared/* @games/* @db/* @lib/* @middlewares/*`.
- **Brand tokens (Tailwind, `tailwind.preset.ts`):** `bg-action` (#27B973 brand green — the slide
  colour), `bg-canvas` (#C8E8DA mint page bg), `bg-surface` (#FFFFFF cards), `text-ink` (#1F6B4A
  forest — **never use black**), `ink-3`/`ink-4` (muted), `accent` (#FF8A2A orange — **celebration
  only**), `danger`/`warn`/`info`/`special`, `bg-stage` (#2D5BFF cobalt). `font-serif` = Fraunces
  (headlines/numbers/celebration), `font-sans` = Nunito (everything operational). 8px grid, nothing
  sharp (rounded everywhere), tabular numbers.
- **Sounds (`@gbedity/ui`):** `useSound()` → `play(SoundKey.X)`. Keys: `BUTTON_HOVER`,
  `BUTTON_CLICK`, `GAME_START`, `SUCCESS`, `ERROR`, `COUNTDOWN_TICK`, `ROUND_WIN`. `Button`
  auto-plays `BUTTON_CLICK`. Use `GAME_START` on intro, `ROUND_WIN`/`ERROR` on results.
- **Engine word sources (for word games):** `pickGameWords` / `pickGameDefinitions`
  (`@games/shared/word-picker`) — rank-weighted operational sets → `dictionary` (Webster) fallback.
  NOT the category `words` collection (full of names/cities). Validation engine is deterministic
  (`validationService`), no LLM.

---

## 4. The design language (what the user wants every screen to look like)

The user reviewed and **approved** this. Match it for new games.

**Every screen is a "slide": a bouncing-in, inset, rounded poster panel on the canvas backdrop —
NOT edge-to-edge.** The game reads as a deck of slides. Content is **centred**.

- **Slide frame** (`ui/slide-frame.tsx` in the reference): full-screen canvas-mint backdrop centring
  an inset `rounded-[32px]` panel with a soft green-tinted shadow, that **bounces in** via GSAP
  (`back.out(1.6)`), respecting `prefers-reduced-motion`. Tones: `action` (green — the default brand
  slide), `canvas` (mint), `accent` (orange), `stage` (cobalt). A `compact` flag gives
  content-heavy slides tighter padding.
- **The brand green (`action`) slide is the default look** for intro / question / result. White
  cards (`Card`) pop on green (the "Hot Seat" reference look). The wrong-answer result uses the
  `canvas` tone to feel softer.
- **Contrast rule (the user called this out):** on a green slide, **all labels are solid white**
  (never `text-surface/80`), and **big numbers are rendered in white directly** — `Score`'s `ink`
  tone is dark forest and is *invisible* on green, so for hero numbers on green write the markup
  yourself (`font-serif … text-surface`) instead of using `<Score tone="ink">`.
- **Motion:** intro title and result content stagger in (`back.out` / `power3.out`); letter tiles
  pop with a stagger; the final-score emoji bursts (spring scale+rotate) then idle-bobs; transitions
  150–250ms, celebration up to ~400ms.
- **Kinetic preview first:** every game ships a `/preview-ui` route (`preview/preview-ui-screen.tsx`)
  with a `Segmented` switcher over every screen, rendered as **bare UI with mock props, no logic**.
  The user reviews here before any wiring. (Add per-state toggles, e.g. correct/wrong, as needed.)

### The four canonical solo screens (reference: Missing Letters)
1. **Intro** — full green slide, bouncing title, game name + one-line rules, a `GAME_START` fanfare,
   a "Start" CTA. Client-only opener (no backend dependency).
2. **Question / Play** — green slide, `compact`. A white card holds the prompt (for Missing Letters:
   the masked word as letter tiles), then a card with the timer bar + input, then a facts strip
   (time / round / points-on-offer). All values are props.
3. **Scores (per round)** — verdict slide (green if correct, canvas if wrong), reveals the answer,
   shows **this round's** points only (accent orange, big). Actions: Continue / Exit. **No running
   total here.**
4. **Final score** — the reusable end-of-game celebration: **confetti burst + a congrats emoji that
   adapts to the run** (🏆 ≥85% correct, 🎉 ≥60%, 👏 ≥30%, 🌱 below), animated, the big **white**
   final score, a "N of M correct" pill, and **Play again / Home** buttons. `ROUND_WIN` on mount.
   This is the end-screen pattern for **all** games going forward.

### Copy/voice
Confident, warm host — never teacher/corporate/child. "Nice — you got it." / "Not this time." /
"Continue playing". No exclamation points in chrome (celebration moments only). Numbers plain.

---

## 5. The backend contract (client-driven solo)

### Shape
A thin REST surface under `apps/backend/src/features/solo/<game>/`, mounted at
`/api/v1/solo/<game>` **before** the generic `/api/v1/solo` router (specificity). An **in-memory
session map** keyed by an opaque `soloId` (UUID), idle-TTL swept. The server holds the answers so
they never reach the client until a guess resolves, and validates every submission. **No room, no
socket, no `GameRuntime`, no engine timers.**

### Files (mirror Missing Letters)
- `<game>-solo.service.ts` — the brain: a `Map<soloId, Session>`, a TTL sweeper (`setInterval`,
  `.unref()`), `normalizeConfig` (clamp untrusted input), the scoring function, and the
  `start/round/guess/next/snapshot` methods. Each returns `ServiceResult<T>`. Export a singleton.
- `<game>-solo.controller.ts` — pulls typed fields off the body, calls the service, maps the result
  via `ResponseUtil`. A `fail(res, r)` helper for failed results.
- `<game>-solo.routes.ts` — Express router; `asyncHandler` on async handlers; specific before
  param routes.
- `<game>-solo.service.test.ts` — Jest. Mock the word picker so it's hermetic (no Mongo). Cover the
  scoring curve, config clamping, the full flow, locking, timeout, and every error.
- Mount it in `features/solo/index.ts` (the `/<game>` prefix BEFORE `/api/v1/solo`).

### Endpoint pattern (Missing Letters — adapt the verbs to your game)
| Method · Path | Body | Returns | Notes |
|---|---|---|---|
| `POST /start` | `{config?}` | `{soloId, rounds, config}` | pick content up front; **never return answers** |
| `POST /round` | `{soloId}` | `{idx, rounds, <prompt>, secondsPerRound, …}` | current round, **answer withheld**; idempotent |
| `POST /guess` | `{soloId, text, elapsedMs}` | `{correct, points, answer, totalScore, idx, rounds}` | one-shot lock per round; reveals answer; **speed-weighted score** |
| `POST /next` | `{soloId}` | `{done, idx, rounds, totalScore}` | unanswered round = 0 (timeout); `done:true` ends |
| `GET /:soloId` | — | `{soloId, idx, rounds, totalScore, over}` | reconnect / poll |

### Timing & scoring (the agreed model)
- **Client clock, server lenient.** The client runs the per-round countdown and auto-locks at 0; the
  server accepts a guess whenever it arrives. (Solo = no opponent, so trusting client timing is
  free.)
- **Speed-weighted.** The client sends `elapsedMs` (prompt-shown → submit). The server scales a
  correct guess linearly from a max (1000) down to a floor (400) as `elapsedMs/window` → 1; wrong or
  timeout → 0. Single source for the formula; unit-test it. (Adapt per game; some games may be
  binary or peer-rated — but solo is single-player so collapse multiplayer "rank" scoring to a
  per-player function.)

### Self-test the backend LIVE (do this before any UI)
`nx dev backend` (the user usually has it running on 8090). Then drive the whole flow with `curl`
and assert each step: start → round (masked, answer hidden, idempotent) → guess wrong (reveals
answer, 0 pts) → guess again (409 locked) → next → … → over (409 on round-after-over) → snapshot →
unknown id (404) → empty guess (422). The correct-scoring path can't be proven live (you can't know a
server-secret answer in advance — that's the security property working) → prove it with a
**deterministic unit test** (mock the picker, guess the known word, assert points). Reference
self-test covered all of these and 18 unit tests pass.

### What we changed in the backend for Missing Letters (example of acceptable changes)
- Added `features/solo/missing-letters/{ml-solo.service,ml-solo.controller,ml-solo.routes}.ts` +
  test. Mounted in `features/solo/index.ts`.
- **Extracted shared pure logic to a single source:** moved the masking helpers into
  `games/missing-letters/missing-letters.mask.ts` (`maskPositions`, `maskedString`) and refactored
  the existing multiplayer content resolver to import them — so solo and multiplayer mask
  identically, no duplication, no behaviour change. **This is the pattern: lift pure game logic into
  a shared module both transports use; don't fork it.**
- Added message keys `soloMl.OVER` / `soloMl.ALREADY_ANSWERED`. Reused existing `SOLO_NOT_FOUND`,
  `VALIDATION_ERROR`, `CONFLICT`, `BAD_REQUEST` codes.
- The existing room-based `/solo/start` path is **untouched** — the other ~12 solo games still use
  it. Migrate them later.

---

## 6. The frontend slice anatomy

Self-contained under `apps/game/src/features/games/<game>/`. **No dependency on the old in-game flow
system.** Structure (reference: Missing Letters):

```
features/games/<game>/
├── ui/                      # SHARED pure atoms — props only, no API/socket. Future multiplayer reuses these.
│   ├── motion.ts            #   prefersReducedMotion(), EASE_SPRING ('back.out(1.6)'), EASE_OUT
│   ├── slide-frame.tsx      #   THE bouncing inset poster panel + SlideTone POJO + `compact`
│   ├── confetti-burst.tsx   #   one-shot react-confetti (brand colours, reduced-motion safe)
│   └── <game-specific>.tsx  #   e.g. letter-slots, round-clock, guess-input, meta-strip
├── screens/                 # Per-screen composition (bare UI; every value a prop)
│   ├── intro-screen.tsx
│   ├── question-screen.tsx  #   (the play screen — name it per game)
│   ├── scores-screen.tsx
│   └── final-score-screen.tsx
├── preview/
│   └── preview-ui-screen.tsx   # /preview-ui — Segmented switcher over all screens, mock props, NO logic
└── solo/                    # CLIENT-DRIVEN logic (built AFTER UI is approved)
    ├── logic/
    │   ├── api.ts           #   the REST calls (apiClient.post('/solo/<game>/...')), Zod-parsed responses
    │   ├── machine.ts       #   the client phase enum (INTRO→COUNTDOWN→PLAY→REVEAL→DONE) as a POJO
    │   └── use-<game>.ts    #   the brain: a hook owning phase, current round, score, guess; drives the API
    ├── screens/
    │   └── solo-screen.tsx  #   composition root: phase router mapping machine state → the bare screens
    └── routes.tsx           #   the solo route (e.g. /games/<game>/solo/:soloId)
```

- The `ui/` atoms and `screens/` are **pure** — they take props and render. This is what the
  `/preview-ui` route exercises, and what multiplayer will reuse later.
- `solo/logic/use-<game>.ts` is the **only stateful brain**: it calls `api.ts`, runs the client
  countdown (`requestAnimationFrame`/`setInterval`), holds the phase + round view + guess + score,
  and exposes handlers (`onStart`, `onGuessChange`, `onSubmit`, `onContinue`, `onExit`). **No
  `useRoomSocket`, no patch schema, no registry, no `detectLiveGame`.**
- `solo/screens/solo-screen.tsx` is a thin phase router: read the machine state, render the matching
  bare screen with props from the hook. The intro is client-only (tap to start), then it walks the
  REST flow.

### Entry wiring
The solo launch already exists (play-mode + configure "Start"). Route the new game to its slice via a
small `soloRouteFor(gameId, …)` resolver: for `<game>` return its new client-driven route (after the
relevant `start` call); for every other game fall back to the existing room-based
`/solo/start → /p/:code/game`. Keep the entry generic; only your game opts into the new surface.

### Register the preview route
Add `MISSING_LETTERS_PREVIEW`-style entry to `ROUTES`, lazy-load the screen in `app.routes.tsx`, add
the `{ path, Component }`. (Reference: `MISSING_LETTERS_PREVIEW: '/preview-ui'`.)

---

## 7. Step-by-step playbook for a new solo game

1. **Read the backend plugin** for your game (`apps/backend/src/games/<game>/<game>.plugin.ts`) —
   it is the authoritative source for: phases, the action shape (field names!), the content shape,
   the scoring rule, and what `view(audience='player')` exposes. Don't guess; lift the pure rules.
2. **Backend:** build `features/solo/<game>/` (service + controller + routes + test). Reuse engine
   pure helpers (extract to a shared module if a multiplayer resolver also needs them). Add message
   keys. Mount in `features/solo/index.ts` (specific prefix first). `nx typecheck backend`, run the
   Jest test, **self-test live with curl**. Fix until green.
3. **Frontend UI (bare):** build `ui/` atoms (start from `slide-frame.tsx` + `confetti-burst.tsx`,
   add game-specific ones) and the four `screens/`, then `preview/preview-ui-screen.tsx`. Register
   `/preview-ui`(-style) route. `nx typecheck game` + eslint clean. **Pause for the user to review
   the preview kinetically.** Iterate on look/feel until approved.
4. **Frontend logic:** build `solo/logic/{api.ts, machine.ts, use-<game>.ts}` and
   `solo/screens/solo-screen.tsx` + the solo route. Wire the bare screens to the hook. Add the
   `soloRouteFor` entry so the launch reaches it.
5. **End-to-end:** play it for real against the live backend (`nx dev game` + `nx dev backend`).
   Verify the full loop, reconnect/refresh, and scoring. Typecheck + lint + tests green.
6. **Update memory + this doc** if you discovered a new pattern.

---

## 8. Gotchas & lessons (already paid for)

- **`Score`'s `ink` tone is dark forest → invisible on a green slide.** For hero numbers on green,
  render white markup yourself.
- **Action field names matter.** Missing Letters' guess action is `{type:'missing_letters.guess',
  text}` — the field is `text`, not `value`. Read the plugin's `actionSchema`.
- **Specific routes before parameterized** in Express, and mount specific sub-prefixes before the
  generic `/solo` router, or `/solo/<game>/*` gets swallowed by `GET /:soloId`.
- **Validate untrusted config** server-side — clamp ranges; the client is untrusted input even in
  solo.
- **`view()` / any recovery-path code must never throw** (engine convention) — guard maps with `?? {}`.
- **Don't trust the wire** on the frontend — Zod-parse API responses in `api.ts`.
- **Icons:** verify the lucide name exists (`@icons`); a wrong name renders nothing silently.
  (`RotateCcw` not `Replay`, `Loader2` not `Spinner`.)
- **The Edit tool requires a prior Read** of a file in the session before editing it.
- **`new Date()`/`Date.now()`/`Math.random()`** are fine in normal app/backend code; they're only
  banned inside Workflow scripts (irrelevant here).

---

## 9. Reference index (Missing Letters — read these to copy)

**Backend:** `apps/backend/src/features/solo/missing-letters/{ml-solo.service,ml-solo.controller,
ml-solo.routes,ml-solo.service.test}.ts`; `apps/backend/src/games/missing-letters/
missing-letters.mask.ts`; `features/solo/index.ts`; plugin (rules source):
`apps/backend/src/games/missing-letters/missing-letters.plugin.ts`.

**Frontend:** `apps/game/src/features/games/missing-letters/` (whole slice);
`shared/constants/routes.ts` (`MISSING_LETTERS_PREVIEW`); `app.routes.tsx` (registration).

**Cross-cutting:** `apps/game/src/shared/services/api-client.ts` (`apiClient`),
`shared/services/session-store.ts`, `@gbedity/ui` barrel (`packages/ui/src/index.ts`),
`tailwind.preset.ts` (tokens), `packages/ui/src/sound/sound-manifest.ts` (`SoundKey`).

**The persona/rules source (if you need the full text):**
`/Users/feranmi/codebases/2026/dockito/personas/{backend,frontend,fullstack}.md` and
`/Users/feranmi/codebases/2026/dockito/skills/{frontend-guide,hard-lessons,rules}.md`.
