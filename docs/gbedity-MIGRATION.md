# Gbedity UI · migration from Studio → `@gbedity/ui`

Shipped 2026-05-31. The Studio's bright-room game-night design system was translated into a
React component library at `packages/ui/src/` and surfaced live in the preview gallery at
`apps/game` (`/preview` route, port 5173).

Visual source of truth — never edit, only reference:
**`/Users/feranmi/codebases/2026/dockito/design-system/projects/gbedity/`**

---

## Conventions detected and respected

- **Workspace shape.** Nx + pnpm, `@gbedity/<name>` packages. Apps consume the library as
  source via Vite's resolver (`package.json` `main: ./src/index.ts`), not via the built dist.
- **TypeScript:** strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` +
  `noImplicitOverride` + `noImplicitReturns`. `"moduleResolution": "Bundler"` +
  `"allowImportingTsExtensions": true` lets us use `.ts/.tsx` extensions on relative imports
  (no `.js` — per project rule). The build config emits **declarations only**
  (`emitDeclarationOnly: true`) so source can keep `.ts/.tsx` extensions.
- **Components:** `<kebab>/<kebab>.tsx + index.ts`, barrel re-export from `src/index.ts`,
  named exports only. `forwardRef` on interactive primitives; plain `function` on display.
  Props are `interface XProps extends YHTMLAttributes` (no `readonly` on UI prop fields, matching
  the existing Button).
- **Class composition.** `cn` upgraded from `clsx`-only to `clsx + tailwind-merge` so caller
  `className` overrides win the cascade against the component's defaults.
- **Lint.** `eqeqeq: always`, `no-explicit-any`, `consistent-type-imports`,
  `unused-imports/no-unused-imports`, `no-console: ['error', { allow: ['warn','error'] }]`.
  All generated code conforms.
- **Tests.** Skipped per the decision in Act II. The preview gallery is the verification
  surface. The old `button.test.tsx` (asserting placeholder class names) was removed when
  Button was rewritten.

## Conventions added by this ship

- **The Studio's `bright-room game-night` tokens** replaced the placeholder
  `tailwind.preset.ts`. Stage / canvas / surface / ink / action / accent / state / mist plus
  category tints (`category.casual`, `category.brain`, `category.party`, `category.immersive`).
  Radii scale `btn-sm` (16) · `btn` (20) · `btn-lg` (24) · `card` (20) · `card-lg` (28) · `stage`
  (32). Two font families: `serif` (Fraunces) and `sans` (Nunito).
- **`packages/ui/src/styles.css`** loads `@fontsource-variable/fraunces` +
  `@fontsource/nunito` (weights 400/500/600/700/800), sets body defaults (Nunito + tabular
  numerals + Forest Ink).
- **CSS imports** for fonts in `@gbedity/ui/styles.css` require `@fontsource-variable/fraunces`
  and `@fontsource/nunito` installed in every app that loads it. Both `apps/admin` and
  `apps/game` now have these as dependencies.

---

## Installed dependencies

- `packages/ui`: **`tailwind-merge ^3.6`**
- `apps/admin` + `apps/game`: **`@fontsource-variable/fraunces ^5.2`** and
  **`@fontsource/nunito ^5.2`**

All installed via `pnpm --filter ... add` with explicit confirmation.

---

## Components generated (22)

### Foundation (token consumers, not components)
- `tailwind.preset.ts` — rewritten to express the Studio's tokens
- `packages/ui/src/styles.css` — fontsource imports + body defaults
- `packages/ui/src/utils/cn.ts` — upgraded to `clsx + tailwind-merge`

### Primitives — 6
| Component | Studio spec | Notes |
|---|---|---|
| **Button** | [10-buttons.html](../../dockito/design-system/projects/gbedity/preview/10-buttons.html) | Rewritten. 6 variants: `primary`, `secondary`, `ghost`, `celebrate`, `danger`, `stage`. 3 sizes. `forwardRef`. |
| **Input / Field / RoomCodeInput** | [11-inputs.html](../../dockito/design-system/projects/gbedity/preview/11-inputs.html) | Three exports. RoomCodeInput is the wide-tracked uppercase joiner. |
| **Segmented** | [12-selection.html](../../dockito/design-system/projects/gbedity/preview/12-selection.html) | Generic over value type. Canvas-mint track, white thumb. |
| **Switch** | [12-selection.html](../../dockito/design-system/projects/gbedity/preview/12-selection.html) | Pill body + circular thumb. |
| **Checkbox** | [12-selection.html](../../dockito/design-system/projects/gbedity/preview/12-selection.html) | Square 22×22, action-green tick. |
| **Slider** | [37-pyc-config.html](../../dockito/design-system/projects/gbedity/preview/37-pyc-config.html) | Functional `<input type="range">` styled to spec. |

### Display — 8
| Component | Studio spec | Notes |
|---|---|---|
| **Pill / CategoryChip** | [13-pills-badges.html](../../dockito/design-system/projects/gbedity/preview/13-pills-badges.html) | 7 tones for Pill; CategoryChip tints to game category. |
| **Avatar / AvatarStack** | [13-pills-badges.html](../../dockito/design-system/projects/gbedity/preview/13-pills-badges.html) | 8 seat colours, 4 sizes. Stack with overflow chip. |
| **Card** | [14-cards-tiles-rows.html](../../dockito/design-system/projects/gbedity/preview/14-cards-tiles-rows.html) | 2 sizes, 2 tones (surface / canvas). |
| **Score** | [15-numerals.html](../../dockito/design-system/projects/gbedity/preview/15-numerals.html) | Fraunces tabular numeral. 4 sizes, 5 tones, optional unit suffix. |
| **GameId** | [15-numerals.html](../../dockito/design-system/projects/gbedity/preview/15-numerals.html) | The brand-system 2-digit zero-pad. Tinted at 55% opacity to category. |
| **GameTile** | [14-cards-tiles-rows.html](../../dockito/design-system/projects/gbedity/preview/14-cards-tiles-rows.html) | The signature catalogue tile. Category top, GameId watermark, plain-English description. |
| **LobbyRow / RankedRow** | [14-cards-tiles-rows.html](../../dockito/design-system/projects/gbedity/preview/14-cards-tiles-rows.html) | Two registers — warm canvas (no scores yet) and hairline ranked (post-game). |
| **PreviewRail / PreviewStat** | [33-word-bomb-config.html](../../dockito/design-system/projects/gbedity/preview/33-word-bomb-config.html) | The reusable config-screen rail. PreviewStat for mechanical predictions; compose richer content (sample-argument-and-verdict) as plain children for games where the preview semantic differs. |

### Feedback — 4 components + 3-file imperative service
| Component | Studio spec | Notes |
|---|---|---|
| **Toast / Banner / InlineAlert** | [41-feedback.html](../../dockito/design-system/projects/gbedity/preview/41-feedback.html) | 5 tones. Toast renderable standalone or via DrawerService. |
| **Modal / CriticalModal** | [40-modals.html](../../dockito/design-system/projects/gbedity/preview/40-modals.html) | Standard/danger Modal + CriticalModal with required type-to-confirm. Both `createPortal` to body. |
| **DrawerService** + **ToastHost** + **ModalHost** | composition | Native pub-sub store + service singleton + two host components. `<ModalHost />` + `<ToastHost />` mounted in `apps/game/src/app.tsx`. Call `DrawerService.toast(...)` / `.confirm(...)` / `.critical(...)` from anywhere. |

---

## Studio surfaces skipped (visual specs, not library components)

These are full scenes — they belong in `apps/game/src/features/<game-name>/` as composed app
screens, built from the primitives + display components above. Each is named here so a
developer can build them in the app and reference the spec.

| Scene | Studio file |
|---|---|
| Initial lobby (display TV) | `dockito/design-system/projects/gbedity/preview/30-lobby.html` |
| Game catalogue (host phone) | `dockito/design-system/projects/gbedity/preview/31-catalogue.html` |
| Word Bomb · in-game (display) | `…/preview/32-word-bomb-in-game.html` |
| Word Bomb · configure (host phone) | `…/preview/33-word-bomb-config.html` |
| Word Bomb · post-game (display, stage frame) | `…/preview/34-word-bomb-post-game.html` |
| Sketch & Guess · in-game (display) | `…/preview/35-sketch-in-game.html` |
| Sketch & Guess · post-game (display, stage frame) | `…/preview/36-sketch-post-game.html` |
| Plead Your Case · configure (host phone) | `…/preview/37-pyc-config.html` |
| Plead Your Case · post-game (display, stage frame) | `…/preview/38-pyc-post-game.html` |

The post-game scenes wrap their content in a Stage Cobalt poster-frame (operator-everyday
elsewhere stays on canvas) — that pattern is implemented inline at the scene level for now;
if a second post-game scene gets shipped to the app, factor it to a `StageFrame` primitive
in the library.

The Studio's lobby room card carries a small illustrated **brand mark** in its top-right
corner (a stylised speech-burst, Forest Ink outline + Accent Orange fill). That's an SVG asset
— add it to `packages/icons` and re-export when the lobby screen is built in `apps/game`.

## Compositions worth surfacing as future library components

Some Studio scenes contained recurring patterns that could be promoted to library components
once a second app screen needs them:

- **`StageFrame`** — the cobalt poster-frame + canvas inset + 2-line header ("Final scores" /
  game-id chip). Used on all 3 post-game scenes.
- **`WinnerBar`** — orange accent bar with crown + avatar + name + hero Fraunces score. Used
  on all 3 post-game scenes; varies by trailing content (frozen drawing for Sketch, AI verdict
  for PYC).
- **`RadioCard`** — full-card option picker with title + description + state pill. Used in the
  Game Mode picker (Single vs League). Not in the library yet; build inline first, factor on
  second use.
- **`BrandMark`** — the lobby room-card corner mark SVG. Should live in `packages/icons` not
  `packages/ui` since it's an asset, not a component.

---

## Manual work remaining

1. **Real domain screens.** Build the 9 Studio surfaces above into `apps/game/src/features/`
   using the library primitives. The preview gallery already validates each primitive
   visually; the next step is composition.
2. **`BrandMark` SVG.** Add to `packages/icons` so the lobby room card can use it via the
   `@icons` proxy.
3. **Connect the `apps/admin` operator UI.** It currently renders a placeholder. The admin
   surfaces from the brief (host dashboard, league configurator, custom content libraries) are
   not yet scoped.
4. **Backend wiring.** `apps/backend` is an empty Express scaffold. Out of scope for this
   ship — the UI is ready, the data layer is not.

---

## How to add a new component (the rule, firm)

For each new component, do these steps as a single unit — never batch:

1. Build the component at `packages/ui/src/<kebab>/<kebab>.tsx + index.ts`.
2. Add to the barrel at `packages/ui/src/index.ts`.
3. Create the preview part at
   `apps/game/src/features/preview/screen/parts/<NN>-<name>.tsx`. Exercise the full prop
   surface — variants, states, in-context use.
4. Register **one** entry in `apps/game/src/features/preview/shared/registry.ts` (`PARTS`
   array). Sidebar nav + canvas router both derive from this list — no other wiring.
5. Run `pnpm --filter @gbedity/ui --filter @gbedity/game typecheck`. Fix anything red.
6. Move to the next component.

Never batch previews to the end. The preview is the review surface; a component that isn't
in it is invisible to the designer. Confirmed by the user during this ship and codified in
the Dipstick / TaxLens ship notes.
