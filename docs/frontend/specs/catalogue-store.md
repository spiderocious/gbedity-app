# Spec — Frontend Catalogue Store + Game-Selection Flow

**Status:** spec · awaiting review (no code yet)
**Backend contract:** [`docs/backend/specs/game-catalogue.md`](../../backend/specs/game-catalogue.md)
(implemented; `GET /api/v1/catalogue` is live, returns the `LandingGame` shape).
**Source of truth:** the backend response shape is the contract. The current static
`apps/game/src/shared/games/games-manifest.ts` is what it must match (and replaces).

Two asks, folded together:
1. **One central store** for games. Every place that shows games reads from it (today they each
   import the static `GAMES`). Cache hard via TanStack, with sane invalidation + timed refetch.
2. **A reusable "request a game selection" flow** — any screen can ask the user to pick a game and
   get the choice back via callback, without re-implementing the catalogue grid.

---

## 1. Current state (audited from source)

The frontend already has the infra this builds on: `apiClient` (envelope-aware, coded `ApiError`),
TanStack hooks under `shared/api/`, one `QueryClient` in `app.tsx`
(`retry:false, refetchOnWindowFocus:false`), `ENV.API_BASE_URL`, Zod response types in
`shared/types/api.ts`.

**`games-manifest.ts` (static `GAMES`) has two distinct kinds of consumer** — the refactor must keep
them separate:

| Consumer | Uses | Kind | Action |
|---|---|---|---|
| `landing/.../games-showcase.tsx` | `GAMES` + filter grid | **display** | read from store |
| `catalogue/screen/catalogue-screen.tsx` | `GAMES` + filter grid | **display** | read from store (+ become the selection UI, §4) |
| `configure/screen/configure-screen.tsx` | `gameById` → title/category/meta/desc | **display** | read from store |
| `in-game` / `post-game` / `lobby` headers | `gameById` / `GAMES.find` → title/category/id | **display** | read from store |
| `shared/games/config-map.ts` | `GameKey` → backend id | **logic** | keep (see §6) |
| `shared/games/game-content.tsx`, `content-types.ts`, `game-queue.ts` | `GameKey` (type) | **logic** | keep |
| `landing/shared/hero-moments.ts`, `preview/*` | `GameKey`/`GameCategory` (types) | **types** | keep |

**Duplication to kill:** `games-showcase` and `catalogue-screen` re-implement the *same*
filter-chips + dimming grid. That grid becomes one shared widget (§3.3, §4).

**Drift found (flag, fix as part of this):** `shared/types/api.ts` `RealGameId` lists only **5**
games as backend-implemented; the backend now registers **all 18** and gates visibility via the
catalogue's `active` status. Once the store is the source of "what's playable/shown," `RealGameId` +
`config-map`'s `isRealGame` become redundant for *visibility* — the catalogue (active entries) is the
authority. `config-map` stays only for the **`GameKey` → backend `gameId`** translation needed to
*start* a game (and even that the API now returns as `gameId` per entry — see §6).

---

## 2. The central store — `shared/catalogue/`

A new shared module. One query, one set of selectors, consumed everywhere.

```
src/shared/catalogue/
├── catalogue.types.ts        # Zod schema + CatalogueGame type (mirrors backend LandingGame)
├── use-catalogue.ts          # the single useQuery hook (the store) + queryKey
├── use-catalogue-game.ts     # selector hooks: byId / byKey / byCategory (derive from the cache)
├── catalogue-icon.ts         # iconName(string) → LucideIcon resolver (replaces GAME_ICON map)
└── index.ts                  # barrel
```

### 2.1 Response type (the contract)
Transcribe the backend's public shape to a Zod schema (parsed in the queryFn — never trust the wire):

```ts
export const CatalogueGame = z.object({
  id: z.number(),                 // PRD numeric id
  gameId: z.string(),             // engine id (for start/routing)
  key: z.string(),                // kebab GameKey
  category: z.enum(['casual', 'brain', 'party', 'immersive']),
  mode: z.string(),
  title: z.string(),
  description: z.string(),
  estMinutes: z.number(),
  players: z.object({ min: z.number(), max: z.number().nullable(), recommendedMax: z.number() }),
  meta: z.string(),               // server-formatted "2–10 · 7m"
  iconName: z.string(),
});
export type CatalogueGame = z.infer<typeof CatalogueGame>;
```

This **replaces** `LandingGame` as the runtime catalogue type. `GameKey`/`GameCategory` *const
objects* stay (logic consumers + types reference them), but the **data** is the API now.

### 2.2 The hook (caching strategy — the second ask)

```ts
export const catalogueQueryKey = ['catalogue'] as const;

export function useCatalogue() {
  return useQuery({
    queryKey: catalogueQueryKey,
    queryFn: async () => z.array(CatalogueGame).parse(await apiClient.get('/catalogue')),
    placeholderData: GAMES_FALLBACK,        // static manifest shown instantly while the first fetch runs / if it fails (§7.3 — keep as fallback)
    staleTime: 2 * 60 * 1000,   // 2 min fresh (locked) — a just-activated game appears within ~2 min without a reload
    gcTime: 30 * 60 * 1000,     // keep in cache 30 min after last use
    refetchInterval: 2 * 60 * 1000,         // background refresh every 2 min (admin may activate a game mid-session)
    refetchOnWindowFocus: true,             // re-tab after admin change → pick it up (overrides the app default)
    refetchOnReconnect: true,               // network back → refresh
    retry: 2,                               // transient network: a couple of retries (overrides app default off)
  });
}
```

**Why these numbers** (locked with the owner; per the perf guide's "set staleTime by how often data
changes"): 2-min `staleTime` + 2-min background interval + focus/reconnect refetch means an admin
activating a game in this environment's DB surfaces within ~2 minutes (or instantly on tab-focus)
with no hard reload, while still avoiding per-keystroke refetch churn while the host browses.
**Invalidation hook** (for when this app itself mutates the catalogue, e.g. a future in-app admin
surface): export `invalidateCatalogue(queryClient)` =
`queryClient.invalidateQueries({ queryKey: catalogueQueryKey })`.

**Fallback (locked — keep `GAMES`):** the static `games-manifest.ts` `GAMES` array is mapped once to
`CatalogueGame[]` as `GAMES_FALLBACK` and used as `placeholderData`, so the showcase/picker render
instantly on cold load and degrade gracefully if `/catalogue` is unreachable. It is **fallback only**
— the live query always wins once it resolves. (This supersedes the earlier "delete GAMES" note.)

> **Single in-flight request guarantee:** because every consumer uses the *same* `queryKey`, TanStack
> dedupes — N components mounting at once trigger **one** network call, all share the cache. That is
> the "one central store" property, for free.

### 2.3 Selectors (derive, don't refetch)
`useCatalogueGame(idOrKey)` and `useCatalogueByCategory(cat)` read from the **same** cached query via
`useCatalogue()` + a `select`/`find` — no second request. A non-hook `findGame(list, idOrKey)` helper
covers places that already have the array.

### 2.4 Icons
The backend sends `iconName` (e.g. `'Target'`). Replace the `GAME_ICON: Record<GameKey, LucideIcon>`
map with `iconFor(iconName: string): LucideIcon` resolving against `@icons` (lucide), with a safe
fallback glyph if a name is unknown. Keeps the icon swappable and driven by admin data, not a
hardcoded per-key map. (Lucide-not-emoji rule preserved.)

---

## 3. Display-consumer migration

### 3.1 Loading / empty / error (new — the static array never had these)
Each consumer now handles three states the static import didn't need. Use the existing `<Show>` /
query patterns:
- **loading** → skeleton tiles (a `GameTileSkeleton`, or reuse a shimmer) — not a bare spinner, to
  avoid layout shift on the grid.
- **error** → an inline retry affordance (the showcase is marketing → a soft "Couldn't load games —
  retry"; the host catalogue → same, blocking the pick until it loads).
- **empty** (`data.length === 0`, e.g. nothing active yet) → a branded empty state
  ("No games live yet." — host; the public showcase simply renders nothing/the fallback copy).

### 3.2 Per-screen changes
- **`games-showcase.tsx`** — replace `GAMES` import with `useCatalogue()`; map over `data`; tile
  onClick stays a "coming soon" toast (landing is marketing). Filter logic unchanged.
- **`catalogue-screen.tsx`** — replace `GAMES` with `useCatalogue()`; becomes the **selection host**
  (§4) — its tile onClick is driven by the selection request, not a hardcoded route.
- **`configure-screen.tsx`** — `gameById(gameId)` → `useCatalogueGame(gameId)`; loading/not-found
  states (a 404 game id → "That game isn't available").
- **`in-game` / `post-game` / `lobby` headers** — swap `gameById`/`GAMES.find` for the selector
  hook. These already have a room/game context; the lookup is cheap off the cache.

### 3.3 Shared grid widget — `shared/catalogue/catalogue-grid.tsx`
Extract the filter-chips + dimming GameTile grid that showcase and catalogue-screen both have today
into one widget: `<CatalogueGrid games onPick />`. Showcase passes an `onPick = toast`; the selection
flow passes `onPick = resolve(game)`. One grid, two callers — kills the duplication §1 flagged. (GSAP
reveal stays opt-in via a prop so the marketing page keeps it and the picker can skip it.)

**Dynamic filters (locked rule):** the category filter chips render **only when the unfiltered total
game count > 10** — i.e. gated on `games.length`, the *original* set, **not** the currently-filtered
count. So:
- With ≤ 10 active games, no filter UI shows at all (the grid is small enough to scan).
- With > 10, the chips appear; selecting a category that narrows the visible set to (say) 3 does
  **not** hide the chips — they stay, because the gate is the original `games.length`, letting the
  user switch/clear the filter.

```ts
const showFilters = games.length > 10;  // original count, computed BEFORE any category filter applies
```

This lives in `CatalogueGrid` so every caller (showcase, host catalogue, selection overlay) gets the
identical behaviour from one place. It naturally adapts per-environment: a staging DB with 6 active
games shows no filters; prod with 18 shows them — driven by the live store, no config.

---

## 4. Game-selection flow (the first ask) — `shared/catalogue/game-selection`

> "A page can request a game selection; we show the list; callback with the picked game."

A small context + imperative hook so **any** screen requests a pick and gets the chosen
`CatalogueGame` back, without owning the catalogue UI.

### 4.1 Shape
```ts
// useGameSelection() — imperative, promise-based (mirrors DrawerService's ergonomics)
const { selectGame } = useGameSelection();
const game = await selectGame({ title?, filterCategory?, exclude? });  // CatalogueGame | null (null = cancelled)
```

**Presentation — overlay picker (LOCKED):** `selectGame()` opens a full-screen `CatalogueGrid` over
the current screen (via a provider mounted at app root, like `ModalHost`). User taps a tile → the
promise resolves with that game → overlay closes. Cancel (Esc / scrim / close button) → resolves
`null`. No route change; works from any screen (lobby "add a game", league builder, quick-play). The
overlay reuses `CatalogueGrid`, so it inherits the §3.3 dynamic-filter rule for free.

### 4.2 Why this is needed (grounded in the existing screens)
- **`host-lobby-screen.tsx`** already builds a `gameQueue` (the file open in the IDE) — "add a game to
  the room" is exactly a selection request that should hand back a `CatalogueGame` to enqueue.
- **League builder** (`HOST_LEAGUE_NEW`) queues multiple games — repeated selection requests.
- **Quick play / single-game** — one selection → configure → start.

Today `catalogue-screen` hardcodes its tile onClick to route to configure. The selection flow makes
that one *behaviour* the caller supplies — so the same catalogue serves lobby-add, league-add, and
quick-play without three copies.

### 4.3 Provider
`<GameSelectionHost />` mounted once in `app.tsx` (sibling to `ModalHost`/`ToastHost`). It renders the
overlay `CatalogueGrid` (fed by `useCatalogue()` — same cache, no extra fetch) when a request is
pending, and resolves the caller's promise on pick/cancel. The provider is the only place the picker
UI lives; `useGameSelection()` is the only API callers touch.

---

## 5. App wiring
- `app.tsx` — mount `<GameSelectionHost />` alongside the existing hosts. QueryClient unchanged
  (per-hook overrides cover the catalogue's focus/retry needs, so the conservative app defaults stay).
- No new routes required for option A. Option B would add a `return`/`token` query-param contract to
  `HOST_CATALOGUE`.

---

## 6. The `RealGameId` reconciliation — delete it, drive from the catalogue (LOCKED, #4)

**The realization:** `RealGameId` (the hardcoded 5-game "what the backend implements" list) and
`config-map`'s `isRealGame` were the frontend *guessing* a fact the backend already owns. "Which games
are playable & shown" is **runtime, per-environment state** — a plugin is playable if registered, and
shown if its catalogue entry is `active`. Staging's DB and prod's DB can have *different* active sets.
**`GET /api/v1/catalogue` already returns exactly that, per environment, with each game's own
`gameId`.**

So the per-environment worry resolves itself by **removing the hardcoded list entirely** — there is
nothing to reconcile across staging/prod DBs because the frontend stops carrying a list at all:

- **Delete** `RealGameId` / `REAL_GAME_IDS` (`shared/types/api.ts`) and `isRealGame` /
  `backendGameId`-as-a-gate (`config-map.ts`).
- **Every game the catalogue returns is real and startable.** The *start* path reads `game.gameId`
  straight off the `CatalogueGame` entry (the API includes it) — no key→backend-id lookup, no
  "is this one of the 5?" check, no per-env list.
- **`config-map` survives only as a client-config-richness fallback**, decoupled from the false
  "real vs not-real" axis: some games have a rich client config/content UI (`game-content.tsx`,
  `config-schema.ts`), most fall back to a sensible default config screen. That is a *UI-richness*
  question (does this client build a custom configurator for it yet?), not a *backend-existence*
  question — and it gracefully defaults for the rest. Rename/repurpose accordingly
  (`hasCustomConfig(key)` style), or fold it into the content map's own presence check.
- **Net:** no list drifts, ever; new games activated in any environment's DB appear and start with
  zero frontend change. This is the architectural fix, not a 5→18 patch.

### What still stays (logic, not display)
- `shared/games/game-content.tsx`, `content-types.ts`, `game-queue.ts`, `config-schema.ts` — client
  game config/content keyed by `GameKey`; **unchanged** (the §6 fallback note governs how the absence
  of a rich entry degrades, not whether the game is "real").
- `GameKey` / `GameCategory` const objects in `games-manifest.ts` — **keep** (logic + types ref them).
- **`GAMES` static array** — **kept as fallback** (§2.2 `GAMES_FALLBACK` / `placeholderData`), mapped
  to `CatalogueGame[]`. The live query always wins; `GAMES` only renders before the first fetch
  resolves or if `/catalogue` is unreachable. (Per the owner — this overrides the earlier
  delete-it stance.)

---

## 7. Decisions (locked with the owner)
1. **Selection UI → overlay.** Full-screen `CatalogueGrid` over the current screen via an app-root
   provider; promise resolves the picked game / `null` on cancel. No routing coupling. (§4.1)
2. **Cache cadence → 2 min.** `staleTime` + background `refetchInterval` = 2 min, plus
   focus/reconnect refetch; a just-activated game appears within ~2 min (or on tab-focus). (§2.2)
3. **`GAMES` → kept as fallback.** Used as `placeholderData`, never the primary source. (§2.2, §6)
4. **`RealGameId` → deleted; drive from `game.gameId`.** No hardcoded list → no per-environment
   (staging/prod DB) reconciliation. Folded into THIS slice. (§6)
5. **Dynamic filters → gated on the unfiltered total > 10.** In `CatalogueGrid`, computed from the
   original `games.length`, not the filtered count. (§3.3)

---

## 8. Verification (definition of done)
- `@gbedity/game` typecheck ✅ · lint ✅ · screens-smoke test green (it imports `GAMES` today —
  update it to read the store / a mocked `useCatalogue`).
- Every **display** consumer reads `useCatalogue()` (selectors); the only remaining `GAMES` reference
  is `GAMES_FALLBACK` in the store hook (grep: no display screen imports `GAMES` directly).
- One network call for N consumers (verified: shared `['catalogue']` queryKey dedupe).
- **No `RealGameId` / `isRealGame` left** (grep clean); the start path uses `game.gameId` from the
  catalogue entry. Confirm a game *not* in the old 5-list now starts.
- `selectGame()` (overlay) resolves the picked `CatalogueGame` from lobby-add; returns `null` on
  Esc/scrim/close.
- **Dynamic filters:** with a mocked catalogue of ≤10 games, no filter chips render; with >10, chips
  render and persist after a category narrows the visible set to <10.
- Loading/empty/error render on each consumer; `placeholderData` shows the fallback instantly on cold
  load and on API failure.
- A `/preview` (or edge-states) entry demonstrates the selection overlay + the three query states +
  the >10 vs ≤10 filter behaviour.
```
