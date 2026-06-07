# Spec — Game Catalogue (admin-curated, public read)

**Status:** spec · awaiting review (no code yet)
**Source of truth:** the PRD (`dockito/projects/gbedity/prd.md` §6 catalogue, §9 host experience).
Where this spec and the PRD disagree, the PRD wins — flag the drift, don't silently diverge.
**Companion:** [`game-engine.md`](../game-engine.md) (the plugin/manifest contract this reads from),
[`build-phases.md`](../build-phases.md) (tracker — this is a new game-agnostic admin + public slice).

---

## 0. Problem

The landing showcase (`apps/game/.../games-showcase.tsx`) reads a **static** `GAMES` array
(`apps/game/src/shared/games/games-manifest.ts`). The manifest's own comment states the intent:
*"When the backend lands, the catalogue API returns this same `LandingGame` shape, so the showcase
reads it unchanged and wiring is a drop-in swap."* **That endpoint does not exist.** There is no
HTTP route anywhere that returns the game list (confirmed: only `health`, `rooms`, `admin`, `host`,
`league` are registered).

Meanwhile all 18 plugins now self-register (`src/games/index.ts` → `registerGames()`), each carrying
a `manifest`. So the *eligibility* data is in memory (`listPlugins()`), but three things are missing
to serve the UI:

1. **No presentation data** — the manifest has `title/category/mode/players/capabilities` but **no
   `description` and no average-time**. The UI needs both.
2. **No curation** — the PRD (§6, §9) implies a real catalogue; per the product decision, *a game
   being built ≠ a game being shown*. Only **admin-approved (active)** games appear to users.
3. **Contract drift** between the two sides (see §1) — encodings differ; the backend must do the
   translation so the UI gets one clean, complete shape.

### Decision (locked with the owner)

- The catalogue is an **admin-curated, persisted entity**. Eligible games = plugins that are
  registered (built & working). The admin sets each game's **description, estimated minutes, player
  range override, icon, category/type label, etc.**, and **activates/deactivates** it. Only active
  entries are served to the public UI.
- **The backend does the translation.** The public endpoint returns everything the UI needs in the
  UI's own encoding (numeric PRD id, kebab key, `casual` category, pre-formatted `meta`) — a true
  drop-in swap. No UI churn, no second copy of catalogue data in the frontend.

---

## 1. The drift this spec resolves (seam audit)

Read both sides before designing — the frontend `LandingGame` is the de-facto contract (it's the
consumer). The endpoint must emit exactly that shape.

| Field | Frontend `LandingGame` | Backend `manifest` (`GameManifest`) | Resolution (backend-side) |
|---|---|---|---|
| `id` | `number` (PRD 1–19; 15 omitted) | `id: GameId` string (`'word_bomb'`) | backend maps `GameId → PRD number` |
| `key` | kebab (`'word-bomb'`) | n/a (manifest id is snake) | backend maps `GameId → kebab key` |
| `category` | `'casual'\|'brain'\|'party'\|'immersive'` (`CategoryKey`) | `'quick'\|'brain'\|'party'\|'immersive'` | backend maps `quick → casual` |
| `title` | ✅ | ✅ | passthrough |
| `description` | ✅ | ❌ absent | **admin-authored** (new) |
| `meta` (`"2–10 · 8m"`) | ✅ pre-formatted | `players.{min,max}` only — no time | backend formats from `players` + admin `estMinutes` |
| `mode` | not consumed | ✅ | included as extra context (see §4) |
| `players.{min,max,recommendedMax}` | encoded in `meta` only | ✅ | included raw **and** in `meta` |
| `icon` | UI maps `GameKey → lucide` (`game-icons.ts`) | ❌ | **admin-set icon name** (string), UI still owns the lucide map; icon name is extra context |

**Rule honored (§0.5 / no-inline-variant-strings):** every enum the endpoint emits (category, mode)
is a named `as-const` value; the `GameId → {prdId, key, uiCategory}` mapping is one named table, not
scattered literals.

---

## 2. Data model — `CatalogueEntry` (Mongo)

New collection `catalogue_entries` (mirrors the `content-admin.repository` doc shape: stable `id`,
`createdAt`/`updatedAt` epoch-ms, cursor on `_id`).

```ts
// features/catalogue/catalogue.constants.ts  (no inline variant strings)
export const CatalogueStatus = {
  DRAFT: 'draft',      // created, not yet shown to users
  ACTIVE: 'active',    // approved → served by the public endpoint
  INACTIVE: 'inactive',// pulled from the public endpoint (kept, not deleted)
} as const;
export type CatalogueStatus = (typeof CatalogueStatus)[keyof typeof CatalogueStatus];
```

```ts
export interface CatalogueEntryDoc {
  id: string;                 // cat_<ULID> (new ID_PREFIX.CATALOGUE)
  gameId: string;             // the engine GameId — the link to the plugin (unique)
  status: CatalogueStatus;    // draft | active | inactive
  // Admin-authored presentation:
  description: string;        // the subtitle/blurb the UI shows
  estMinutes: number;         // average play time in minutes (drives "· 8m" in meta)
  iconName: string;           // lucide icon name (e.g. 'Target') — UI proxies via @icons
  // Player-range override (optional). Falls back to the plugin manifest's players when absent.
  playersMinOverride?: number;
  playersMaxOverride?: number | null;
  sortOrder: number;          // explicit ordering for the showcase (defaults to PRD id)
  createdAt: EpochMs;
  updatedAt: EpochMs;
}
```

Notes:
- **`gameId` is the join key and is unique** — one catalogue entry per game. A unique index on
  `gameId` enforces it (so "create" for an already-cataloged game is a `409 conflict`).
- **`title`, `category`, `mode`, manifest `players`** are **NOT stored** — they're read live from the
  plugin manifest at request time (source of truth = the plugin). Admin authors only the
  presentation fields. This is the §9.x "don't duplicate what the manifest already owns" rule.
- `status` defaults to `draft` on create. Only `active` is public.
- A game with **no** catalogue entry is eligible but unpublished — it simply never appears in the
  public list (and surfaces in the admin "eligible, not yet cataloged" view, §3.4).

### Indexes (ensure at boot, like `ensureAdminIndexes`)
- `{ gameId: 1 }` unique
- `{ status: 1, sortOrder: 1 }` (public list query path)

---

## 3. Endpoints

### 3.1 Public — `GET /api/v1/catalogue`  (no auth)

The drop-in swap for the static `GAMES` array. Returns **active** entries only, joined to live
plugin manifests, translated to the UI's `LandingGame` encoding, ordered by `sortOrder`.

**Response — 200** (`{ data }` envelope, `ResponseUtil.ok`):
```jsonc
{
  "data": [
    {
      "id": 5,                       // PRD numeric id (mapped from gameId)
      "gameId": "wordshot",          // engine id — extra context for start flow / routing
      "key": "wordshot",             // kebab key the UI already keys on
      "category": "casual",          // UI CategoryKey (quick→casual mapped)
      "mode": "simultaneous",        // extra context (UI may ignore)
      "title": "Wordshot",           // from manifest
      "description": "A letter and a category. Type a valid answer that fits, fast.",
      "estMinutes": 7,
      "players": { "min": 2, "max": null, "recommendedMax": 10 }, // effective (override ∨ manifest)
      "meta": "2–10 · 7m",           // server-formatted from players + estMinutes
      "iconName": "Target"           // lucide name; UI still owns the GameKey→icon map as fallback
    }
    // …active games, sorted
  ]
}
```

- **Not paginated** — the catalogue is ≤ ~19 items, bounded by the plugin set. A flat array matches
  the UI's `GAMES: readonly LandingGame[]` exactly. (If it ever grows past the game set, revisit;
  the cursor codec exists if needed.)
- **`meta` formatting** (server helper, single source): `"<min>–<max> · <estMinutes>m"`, where an
  unbounded `max` (null) renders the recommendedMax (matches the static manifest, e.g. wordshot
  `2–10`). Exact rule pinned in the contract test.
- An active entry whose `gameId` **isn't in the registry** (plugin removed) is **skipped** and
  logged (defensive — same spirit as recovery skipping unknown plugins). It never 500s the list.

**The frontend swap:** `games-showcase.tsx` replaces the static `GAMES` import with a React-Query
hook (`useCatalogue()`) that returns the same `LandingGame[]`. The `meta`, `category`, `key`, `id`
all already match, so the tile/filter code is untouched. `description` moves from the static file to
the response (already the same field). The UI keeps `game-icons.ts` as the icon source, optionally
preferring `iconName` when present.

### 3.2 Admin — author & curate (all behind `requireAdmin`)

Mirrors the existing admin content CRUD style (`admin.routes.ts`, `content-admin.repository`).
Registered under the existing `/api/v1/admin` router (specific paths before parameterized).

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| GET | `/admin/catalogue` | — | `{ data: AdminCatalogueRow[] }` | **all** entries (any status) joined to manifest + an `eligible` flag; includes games with no entry yet (§3.4) |
| POST | `/admin/catalogue` | `{ gameId, description, estMinutes, iconName, playersMinOverride?, playersMaxOverride?, sortOrder? }` | `{ data: entry }` (201) | `gameId` must be a registered plugin → else `422 validation_error`; duplicate `gameId` → `409 conflict`. Starts `draft`. |
| GET | `/admin/catalogue/:gameId` | — | `{ data: entry }` | `404 not_found` if no entry |
| PATCH | `/admin/catalogue/:gameId` | partial of the above | `{ data: entry }` | edit presentation fields / overrides / sortOrder |
| POST | `/admin/catalogue/:gameId/activate` | — | `{ data: entry }` | sets `status = active` |
| POST | `/admin/catalogue/:gameId/deactivate` | — | `{ data: entry }` | sets `status = inactive` (kept, hidden from public) |
| DELETE | `/admin/catalogue/:gameId` | — | 204 | hard-delete the entry (game stays eligible, just uncataloged) |

`AdminCatalogueRow` = the entry fields + live `title/category(quick)/mode/players` from the manifest
+ `eligible: true` + `hasEntry: boolean`. The admin UI uses this to author and approve in one view.

### 3.3 Validation (Zod, at the service boundary → 422 with `field_errors`)
```ts
const upsertSchema = z.object({
  gameId: z.string(),                       // existence checked against the registry separately
  description: z.string().min(1).max(280),
  estMinutes: z.number().int().positive().max(120),
  iconName: z.string().min(1),
  playersMinOverride: z.number().int().positive().optional(),
  playersMaxOverride: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
```
- `gameId` not in `listPlugins()` → `422 validation_error` + `field_errors.gameId` (mirrors how
  `rooms.service` validates the plugin lookup, but as a field error since the admin typed it).
- Override range sanity (`min ≤ max` when both present) → `422`.

### 3.4 Eligibility view (admin authoring affordance)
`GET /admin/catalogue` joins the registry against existing entries so the admin sees, in one list:
**every registered plugin**, with `hasEntry`/`status`, so "build a game → it shows up here as
eligible-but-undrafted → admin authors + activates → it appears to users" is the full lifecycle with
no hidden step.

---

## 4. New `ERROR_CODES` / `MESSAGE_KEYS`

Per the no-inline rule, add (don't inline):
- `ERROR_CODES`: `CATALOGUE_ENTRY_EXISTS: 'catalogue_entry_exists'` (409 on duplicate gameId);
  reuse `NOT_FOUND`, `VALIDATION_ERROR`.
- `MESSAGE_KEYS.catalogue`: `CREATED`, `NOT_FOUND`, `ALREADY_EXISTS`, `UPDATED`, `ACTIVATED`,
  `DEACTIVATED`, `INVALID_GAME` (gameId not a registered plugin).
- `ID_PREFIX.CATALOGUE = 'cat_'`.

---

## 5. File layout (FSD / repo conventions)

```
src/features/catalogue/
├── index.ts                    # register(app) mounts public GET /api/v1/catalogue; ensureCatalogueIndexes()
├── catalogue.constants.ts      # CatalogueStatus (+ the GameId→{prdId,key,uiCategory} mapping table)
├── catalogue.routes.ts         # public route(s); asyncHandler-wrapped
├── catalogue.controller.ts     # thin: unwrap ServiceResult → ResponseUtil
├── catalogue.service.ts        # business logic; ServiceResult<T>; joins registry + repo; translation + meta formatting
├── catalogue.repository.ts     # Mongo CRUD over catalogue_entries (mirrors content-admin.repository)
└── catalogue.schema.ts         # Zod upsert schema + the public LandingGame response schema (contract test)
```
Admin endpoints live in the **admin** feature (extend `admin.routes.ts` + `admin.controller.ts`),
calling `catalogueService` — same pattern as admin content authoring calling the content repo. The
public read is its own `catalogue` feature, registered in `app.ts` (order: with the other public
features, before not-found/error). The **translation table is engine-adjacent** but lives in the
catalogue feature since it's a UI-encoding concern, not an engine concern.

---

## 6. Order of implementation (per the persona's working style)

1. **Contract first** — pin the public `LandingGame` response shape (it already exists in the FE;
   transcribe it to `catalogue.schema.ts` Zod and the `GameId→{prdId,key,uiCategory}` table).
2. Data model + `catalogue.repository` + indexes.
3. `catalogue.service` (`ServiceResult<T>`): public `listActive()` (join + translate + format meta),
   admin upsert/activate/deactivate/list-with-eligibility.
4. Controllers + routes (public + admin), `requireAdmin` on admin paths, `asyncHandler` everywhere.
5. **Contract test at the seam** — parse the public response through the Zod schema; assert
   `category ∈ {casual,brain,party,immersive}`, `id` numeric, `meta` format, active-only, unknown
   plugin skipped. Admin RBAC + duplicate/validation cases.
6. **Frontend swap** — `useCatalogue()` React-Query hook + `EP.CATALOGUE` constant; `games-showcase`
   reads the hook instead of the static array (loading/empty/error states); keep the static `GAMES`
   as the typed fallback shape until the hook lands, then delete it.

---

## 7. Out of scope (this slice)

- Custom-content authoring per game (already a separate admin surface).
- Per-host catalogue customization / favorites (host accounts exist; catalogue is global in v1).
- League queue building (separate feature already exists).
- i18n of description copy (English now; structure won't block it).

---

## 8. Open confirms before build

1. **`meta` for unbounded max** — render the soft cap (`recommendedMax`) as the upper bound (matches
   the current static manifest, e.g. wordshot `2–10`)? Or show `2+`? *(Spec assumes recommendedMax.)*
2. **Seeding** — do we seed the 18 entries (mirroring today's static `GAMES`, all `active`) via an
   idempotent admin/bootstrap seed so the showcase isn't empty on first deploy, or does the admin
   author each from scratch? *(Recommend: an idempotent `catalogue:seed` mirroring the current
   manifest so the swap is zero-regression, then admin curates from there.)*
3. **`mode`/`iconName` in the public payload** — include as extra context now (cheap, future-proofs
   the host start flow + lets the UI prefer a server icon), or omit until a consumer needs them?
   *(Spec includes them as additive, non-breaking context — "give the UI all the info it needs.")*
```
