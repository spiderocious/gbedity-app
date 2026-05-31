# Backend QA Handoff — 5-Game Coverage Slice + Full Remaining Backend

**Date:** 2026-05-31
**Build:** Typecheck ✅ · Lint ✅ · Tests ✅ (10/10, 6 suites) · e2e smoke ✅ (real Quizzes game ran on seeded content)
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`
**Spec:** [`docs/backend/full-backend-spec.md`](../../backend/full-backend-spec.md) · **API:** [`docs/backend/api-docs.md`](../../backend/api-docs.md)
**Builds on:** the engine ([`game-engine.md`](../../backend/game-engine.md)) — unchanged contract.

> Scope: this slice makes the **entire remaining backend** real, exercised by **5 games chosen for
> total system coverage**: Quizzes, Wordshot, Word Bomb, Hot Take Court, Plead Your Case. After it,
> every backend subsystem (content, validation, AI, league, persistence, admin, auth, history) is
> hit by a real game.

---

## Prerequisites

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env     # placeholders are runnable
# from apps/backend:
npx tsx --env-file=.env src/seeds/words.seed.ts    # ~2.6k words/14 cats + 5k dictionary
npx tsx --env-file=.env src/seeds/content.seed.ts  # quiz deck + hot-takes + plead scenario + rubric
nx dev backend                                     # http://localhost:8090
```

- **MongoDB** required (`MONGO_URL`). **Redis** optional (recovery only; gameplay works without).
- **OpenAI**: `.env` ships a **placeholder key** → Plead Your Case runs but every evaluation returns
  **"evaluation failed"** gracefully. Drop a real `OPENAI_API_KEY` to light up AI scoring.
- **Admin seeding** is enabled in `.env.example` (`CAN_SEED_ADMIN=true`).
- **Word data**: the seed loads a *small* sample of all 14 categories. The full ~1.5M-word bulk is a
  user-run step — see [`apps/backend/src/seeds/README.md`](../../../apps/backend/src/seeds/README.md).

---

## What's in this slice

| Area | Status |
|---|---|
| Content service + **server-side rating filter** (clients can't bypass) | ✅ |
| Validation service — wordmaster multi-level engine (levels 0–4, farOffs, fuzzy), **no LLM** | ✅ |
| AI service — Plead scoring (OpenAI; placeholder-safe), env prompt + Mongo rubric | ✅ |
| Game-play persistence (`game_plays` + `session_events`) | ✅ |
| **Quizzes** (simultaneous, time-weighted, answer secrecy) | ✅ |
| **Wordshot** (ranked simultaneous, real validation, randomizer) | ✅ |
| **Word Bomb** (round-robin, decaying bomb, validation, no-repeat) | ✅ |
| **Hot Take Court** (submit→anonymous vote, rating-filtered) | ✅ |
| **Plead Your Case** (AI rubric, absolute+comparative, host override) | ✅ |
| Admin auth (one-shot seed, JWT access+refresh, reuse-revoke) | ✅ |
| Admin history + per-game metrics | ✅ |
| Admin content authoring — **full CRUD per kind** + rubric recalibration | ✅ |
| Host auth (register/login/refresh) | ✅ |
| League HTTP surface (queue, weights, aggregate, standings) | ✅ |
| Recovery + reconnect protocol (`server.resumed`) | ✅ |
| k6 load test script | ✅ |

---

## Smoke flow to verify (HTTP + WS)

1. `POST /rooms {nickname:"Host"}` → note `code`, `hostId`, `hostToken`.
2. `POST /rooms/:code/players {nickname:"Tobi"}` ×2 (Word Bomb needs ≥3, Hot Take ≥3).
3. Socket.IO: `client.join {roomCode, role:"display"}`; each player `client.join {roomCode, role:"player", reconnectToken:<token>}`; host `client.join {roomCode, role:"host", reconnectToken:<hostToken>}`.
4. `POST /rooms/:code/start {hostId, gameId:"quizzes", config:{rounds:3, category:"nigerian"}}` → players receive `server.view` with the question (the **answerIdx is hidden** until reveal — verify).
5. A player `client.action {action:{type:"quizzes.answer", questionIdx:0, choiceIdx:1}}`.
6. After `secondsPerQuestion` → reveal (answer appears) → next → game ends → room returns to `lobby`.
7. Repeat for `wordshot`, `word_bomb`, `hot_take_court`, `plead_your_case`.

**Admin:** `POST /admin/seed {email}` (save the returned password) → `POST /admin/login` → use the
access token for `GET /admin/game-plays`, `GET /admin/metrics`, `POST /admin/content/quiz_deck {…}`.

---

## Edge cases to verify

| Scenario | Expected |
|---|---|
| Start as non-host | 403 `not_host` |
| Start unknown gameId | 404 `game_not_found` |
| Start below min players (Word Bomb < 3) | 409 `not_enough_players` |
| Start while a game runs | 409 `game_already_running` |
| Wordshot: submit a real word in category | scores; appears in live top-N on display |
| Wordshot: submit gibberish | not scored; player gets a `suggestion` (near-miss) |
| Word Bomb: repeat a used word | scores 0, bomb advances |
| Word Bomb: non-holder submits | ignored |
| Hot Take: player views defences | **no author/playerId leaked**; anonymous labels only |
| Hot Take: vote own defence | ignored |
| Plead (placeholder key) | each player shows "evaluation failed"; round still completes |
| Admin endpoint without token | 401 `unauthorized` |
| `POST /admin/seed` twice | 2nd → 409 `conflict` |
| Admin refresh reuse (old token) | 401 `session_revoked` (chain revoked) |
| Content outside host rating filter | never served (server-side filter) |
| Restart mid-game (Redis up) | room + game recovered; missed deadlines fire |

---

## Known limitations (intentional — not bugs)

- **AI needs a real key** to actually score Plead (placeholder → "evaluation failed"). By design.
- **Word seed is a small sample.** Full 14-category bulk is a user-run seed step (documented).
- **No LLM in word validation** (Q4) — pure DB + fuzzy. Novel valid words not in the DB won't score.
- **League completion** auto-advances games; a full "league finished → ceremony" event is minimal
  (standings are queryable via `GET /rooms/:code/league/standings`).
- **Tests are smoke-level** (engine contract + room/start). Per-game deep test suites are a later pass.
- **Other 13 games** are not built — they slot into `src/games/` the same way these 5 do.

---

## Layering / quality notes

- Engine imports **zero** `@features` — validation, AI, persistence, and content resolution are all
  injected at bootstrap (`src/bootstrap.ts`). Games live in `@games`, depend on engine + content
  service only.
- Every variant string is a named `as const` POJO (no inline literals).
- All services return `ServiceResult`; controllers map to `ResponseUtil`; cursor pagination on lists.

---

## Follow-on slices

- **Wave 2 — 8 more games + new content kinds:** see [`wave-2-games-handoff.md`](./wave-2-games-handoff.md)
  (Missing Letters, Scrambled Word, Spelling Fast, Definition Race, Synonyms, Antonyms, Catch the
  Lie, Truth or Dare — and the `definition` / `thesaurus` / `truth_or_dare_prompt` content kinds).

> This document covers the **Wave 1** slice (the original 5 games + full infra). It is intentionally
> scoped to that slice; later waves get their own handoff files for easier management.
