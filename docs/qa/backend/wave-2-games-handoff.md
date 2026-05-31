# Backend QA Handoff — Wave 2: 8 More Games + New Content Kinds

**Date:** 2026-05-31
**Build:** Typecheck ✅ · Lint ✅ · Tests ✅ (12/12) · all 8 new games start end-to-end on seeded content
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`
**API:** [`docs/backend/api-docs.md`](../../backend/api-docs.md) · **Spec:** [`docs/backend/next-5-games-spec.md`](../../backend/next-5-games-spec.md)
**Builds on:** the engine + the Wave 1 slice ([`full-backend-handoff.md`](./full-backend-handoff.md)) — contract unchanged.

> This wave adds **8 games** (13 of 18 now built) and **3 new content kinds**, each with full admin
> CRUD. Datasets (~100 each) were generated and inserted **through the validated admin API**, not
> direct DB writes.

---

## Prerequisites

Same as Wave 1 (Mongo required; Redis optional; admin seeding enabled). Word DB already seeded.
To (re)load the Wave-2 datasets through the admin API:

```bash
# server running + an admin seeded (POST /admin/seed once)
cd apps/backend
node src/seeds/post-content.mjs <adminEmail> <adminPassword>
```

Dataset source files live in `apps/backend/src/seeds/data/` (`definitions.json`, `thesaurus.json`,
`truth-or-dare.json`) — edit/extend there or via the admin content ports.

---

## New games

| Game | Mode | Content source | Notes |
|---|---|---|---|
| Missing Letters | SIMULTANEOUS | word DB (masked) | exact-match, no validation service |
| Scrambled Word | SIMULTANEOUS+rank | word DB (scrambled) | live closeness ranking (in-plugin Levenshtein) |
| Spelling Fast | SIMULTANEOUS | word DB | **client-side TTS** — word goes to DISPLAY only, never players (secrecy); `needsTTS` |
| Definition Race | SIMULTANEOUS+rank | `definitions` (103 seeded) | live closeness ranking |
| Synonyms | SIMULTANEOUS | `thesaurus` (103 seeded) | validation service `mode:relation` (dataset, NO LLM) |
| Antonyms | SIMULTANEOUS | `thesaurus` | shares the relation factory + dataset with Synonyms |
| Catch the Lie | SUBMIT_REVEAL | **player-generated** (no platform content) | submit-all → turn-reveal → vote; lie is server-only |
| Truth or Dare | ROUND_ROBIN+vote | `truth_or_dare_prompts` (50 truths + 50 dares) | rating-filtered; turn+vote composition; threshold config |

**New content kinds + admin CRUD (all rating-filtered, schema-validated):** `definition`,
`thesaurus`, `truth_or_dare_prompt` — full CRUD via `/admin/content/:kind` like the existing kinds.

**Datasets seeded via the validated admin API (not direct DB writes):** 103 definitions · 103
thesaurus (each with synonyms + antonyms) · 100 truth/dare prompts — all `family`, 0 validation
failures.

---

## Things to verify

- **Spelling Fast:** confirm the word appears in the **display** `server.view` (`speak` field) but
  NOT in any **player** view (players get only a `length` cue). This is the answer-secrecy nuance.
- **Synonyms/Antonyms:** a valid synonym scores; a non-synonym doesn't; dataset lookup only (no LLM).
- **Truth or Dare:** only the holder can `choose`; others `vote`; threshold
  (majority/unanimous/any) decides scoring; Dare completion scores higher than Truth.
- **Catch the Lie:** no defence/lie authorship leaks to players; voting can't target your own
  statements.
- **Admin:** `POST /admin/content/definition|thesaurus|truth_or_dare_prompt` validates + 422s on
  malformed input (e.g. missing `ratingTier`, wrong `kind`).
- **Word-DB games** (Missing Letters, Scrambled Word, Spelling Fast): each resolves words from the
  1.24M word DB; verify content appears and the round advances → reveal → next → end → lobby.

---

## Per-game WS action shapes

- missing_letters: `{ type: "missing_letters.guess", text }`
- scrambled_word: `{ type: "scrambled_word.guess", text }`
- spelling_fast: `{ type: "spelling_fast.spell", text }`
- definition_race: `{ type: "definition_race.guess", text }`
- synonyms: `{ type: "synonyms.submit", text }`
- antonyms: `{ type: "antonyms.submit", text }`
- truth_or_dare: `{ type: "truth_or_dare.choose", choice: "truth"|"dare" }` (holder) then
  `{ type: "truth_or_dare.vote", completed: boolean }` (others)
- catch_the_lie: `{ type: "catch_the_lie.submit", statements: [s1,s2,s3], lieIdx }` then
  `{ type: "catch_the_lie.vote", statementIdx }`

(Full configs + content doc shapes are in [`api-docs.md`](../../backend/api-docs.md).)

---

## Known limits (intentional — not bugs)

- Datasets are ~100 each (you extend via admin).
- TTS is client-side (the server sends the word to the **display** only — the display device speaks
  it; players never receive the word during the round).
- Content accuracy was hand-authored — spot-check before production; editable via admin.
- The remaining 5 games (Bible Quiz, Typing Fast, Millionaire, Investigation, Presentation) are not
  built — they slot into `src/games/` the same way these 8 do.
