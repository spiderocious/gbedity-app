# Backend QA Handoff — Wave 3: Final 5 Games + Bulk Content + New Content Kinds

**Date:** 2026-05-31
**Build:** Typecheck ✅ · Lint ✅ · Tests ✅ (12/12) · all 5 new games start end-to-end on seeded content
**Base URL:** `http://localhost:8090/api/v1` · **WS:** Socket.IO on `:8090`
**API:** [`docs/backend/api-docs.md`](../../backend/api-docs.md)
**Prior waves:** [`full-backend-handoff.md`](./full-backend-handoff.md) (Wave 1) · [`wave-2-games-handoff.md`](./wave-2-games-handoff.md) (Wave 2)

> This wave **completes the 18-game catalogue** (5 new games), adds **4 new content kinds** with
> full CRUD, and adds a **bulk-create endpoint** for every content kind (new + existing).

---

## New games (catalogue now 18/18)

| Game | Mode | Content | Notes |
|---|---|---|---|
| Bible Quiz | SIMULTANEOUS | `bible_quiz_decks` (1 deck, 20 Qs seeded) | Quizzes clone + translation/testament filters; own decks |
| Typing Fast | SIMULTANEOUS | `typing_passages` (50 seeded) | score = WPM × accuracy (accuracyWeight slider); pure in-plugin scorer |
| Presentation | ROUND_ROBIN + rating | `presentation_topics` (50 seeded) | **multi-criteria rating** (persuasiveness/entertainment/confidence 1–5) + heckle channel |
| Millionaire | ROUND_ROBIN + ladder | reuses `quiz_decks` | ladder, elimination, **3 lifelines**: 50/50, **Ask-the-Audience (nested poll)**, **Phone-a-Friend (defer to a playing friend)** |
| Investigation | **OPEN_PHASE (new mode)** | `investigation_cases` (20 seeded) | free-explore window → private accusation → reveal; guilty suspect server-only until reveal |

**New content kinds + full CRUD:** `bible_quiz_deck`, `typing_passage`, `presentation_topic`,
`investigation_case` — all via `/admin/content/:kind` (create/list/get/update/delete) and the new
bulk endpoint, schema-validated, `ratingTier` required.

---

## NEW — bulk content creation (all kinds)

`POST /admin/content/:kind/bulk` with `{ items: [doc, …] }`:
- validates **each** item against the kind's schema,
- inserts the valid ones,
- returns `{ inserted, failed, total, errors: [{ index, field_errors }] }` (partial success is fine).

Applies to **every** content kind, new and existing (quiz decks, words, prompts, scenarios,
definitions, thesaurus, truth/dare, bible decks, passages, topics, cases). Datasets for this wave
were injected through this endpoint.

**Datasets seeded (via bulk):** 1 bible deck (20 Qs) · 50 typing passages · 50 presentation
topics · 20 investigation cases — 0 failures. Source files in `apps/backend/src/seeds/data/`;
re-postable via `src/seeds/post-content-w3.mjs`.

---

## Things to verify

- **Millionaire — Ask-the-Audience:** the holder triggers `millionaire.lifeline {lifeline:"ask_audience"}`
  → game enters `audience_poll`; all OTHER players send `millionaire.audience_vote {choiceIdx}`; the
  tally appears in the view; after the poll the holder answers. (Nested simultaneous vote inside a
  round-robin turn.)
- **Millionaire — Phone-a-Friend:** holder sends `millionaire.lifeline {lifeline:"phone_friend",
  friendId}` → that friend (must be playing + not eliminated) sends `millionaire.phone_suggest
  {choiceIdx}`; the suggestion is shown **only to the holder**; the holder still answers.
- **Millionaire — 50/50:** hides two wrong options (`hiddenOptions` in the view) for the holder.
- **Millionaire — elimination/ladder:** wrong answer eliminates the player; correct banks the rung
  value and advances; game ends when out of questions or all eliminated.
- **Investigation (OPEN_PHASE):** during `investigate`, all case materials (brief/suspects/evidence/
  timeline) are served to everyone; the **solution is NOT** in any view until `reveal`. Players can
  change their accusation until the window closes; correct accusers score, fastest gets the bonus.
- **Presentation multi-criteria:** only non-presenters can `rate`; one rating per rater; scores
  aggregate the criteria averages; heckles appear in the view; presenter can't rate themselves.
- **Bible Quiz:** translation/testament config filters which decks resolve; answer hidden until reveal.
- **Typing Fast:** WPM×accuracy — higher accuracyWeight rewards exactness over speed.
- **Bulk endpoint:** post a mix of valid + invalid items → 201 with `inserted`/`failed` counts and
  per-index `errors`.

---

## Known limits (intentional — not bugs)

- Datasets are samples (1 bible deck, 50 passages, 50 topics, 20 cases) — extend via admin/bulk.
- Investigation cases are hand-authored; AI case-generation is not built (CRUD + bulk let you add more).
- Millionaire reuses quiz decks for its ladder (difficulty ordering = deck order); dedicated
  graduated decks can be authored via admin.
- Content accuracy (bible answers, definitions, etc.) was hand-authored — spot-check before prod.
- **The catalogue is now complete (18/18).** No games remain unbuilt.
