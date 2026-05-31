# Gbedity — Next 5 Games: Candidate Specs (for review & selection)

**Status:** spec only · pick the next 5 · no code yet
**Built (5):** Quizzes · Wordshot · Word Bomb · Hot Take Court · Plead Your Case
**Remaining (13):** Bible Quiz · Spelling Fast · Typing Fast · Scrambled Word · Missing Letters ·
Definition Race · Synonyms · Antonyms · Millionaire · Truth or Dare · Catch the Lie · Investigation ·
Presentation
**Source of truth:** PRD §6/§7. **Builds on:** the closed engine + the infra already shipped
(content service, multi-level validation, AI service, persistence, league, admin authoring).

> How to read this: each game lists **mechanic**, **engine mode reused**, **infra reused vs new**,
> **content needed**, **build effort** (S/M/L), and **risk/notes**. The point is to choose for
> *value + low new-risk*, since the 5 built games already prove every subsystem. A new game is
> "cheap" when it reuses an existing engine mode + existing infra and only needs content.

---

## Legend

- **Engine mode** — one of the contract modes already implemented: `SIMULTANEOUS`,
  `SIMULTANEOUS+ranking`, `ROUND_ROBIN`, `SUBMIT_VOTE`, `SUBMIT_REVEAL(+AI)`, `OPEN_PHASE`.
- **Reuses** — infra already built that the game leans on.
- **New** — anything not yet built (the real cost).
- **Effort** — S (a few hours, content + thin plugin), M (new mechanic within an existing mode),
  L (new engine capability or heavy content/AI).

---

## The 13 candidates

### 1. Bible Quiz  ·  Effort: **S**
- **Mechanic:** identical to Quizzes (4-option MCQ, time-weighted) — scripture-themed decks; filters
  for Translation (KJV/NIV/NLT/Yoruba/Igbo/Hausa) + Testament (Old/New/Both).
- **Engine:** `SIMULTANEOUS` — *same as Quizzes*.
- **Reuses:** Quizzes plugin almost verbatim; content service; persistence; league.
- **New:** a `bible_quiz` content kind (deck + translation/testament tags) + admin port; arguably
  just a Quizzes deck with extra tags — could even be a Quizzes *category*.
- **Content:** scripture MCQ decks (hand-authored or imported).
- **Risk:** none mechanically. Decision: separate plugin vs. a Quizzes deck-variant. **Cheapest game on the list.**

### 2. Missing Letters  ·  Effort: **S**
- **Mechanic:** a word with gaps on display ("B _ N _ N _"); players race to type the full word;
  faster-correct = more. Configs: word-length range, # letters hidden (default 3), hint mode.
- **Engine:** `SIMULTANEOUS` — same shape as Quizzes/Wordshot.
- **Reuses:** the **word DB** (1.24M words) for source words + the dictionary; content service;
  scoring; persistence. Validation = exact match against the revealed word (trivial, in-state).
- **New:** a small "pick a word + mask N letters" content resolver over the word DB. No new infra.
- **Content:** *free* — drawn from the existing word DB.
- **Risk:** very low. Proves a new *casual* mechanic with near-zero content cost.

### 3. Scrambled Word  ·  Effort: **M**
- **Mechanic:** a scrambled word shown; players submit guesses; **live ranking by closeness**
  (Levenshtein) — top-N on display, updating in real time; closest/fastest correct wins.
- **Engine:** `SIMULTANEOUS + ranking` — *same as Wordshot's live-ranking path.*
- **Reuses:** the **similarity stack** we already lifted (Levenshtein/Jaro/Soundex/LCS) for the
  closeness ranking; word DB for source words; Wordshot's ranking view pattern.
- **New:** a scramble generator (seeded) + closeness-ranking (not exact-match) scoring. The
  similarity engine exists; this wires it to *ranking* rather than *validation*.
- **Content:** *free* — word DB.
- **Risk:** low. **Best showcase of the fuzzy engine we already built** but barely use.

### 4. Definition Race  ·  Effort: **M**
- **Mechanic:** a definition shown; players race to type the word being defined; live ranking like
  Scrambled Word. Configs: word obscurity, ranking display count.
- **Engine:** `SIMULTANEOUS + ranking`.
- **Reuses:** similarity stack for ranking; close-match scoring; ranking view.
- **New:** **definition→word content** — this is the catch: the word DB has words, not definitions.
  Needs a `definition` content kind (word + its definition), hand-authored or imported from a
  dictionary dataset.
- **Content:** **not free** — needs a definitions dataset (the one real content cost in this tier).
- **Risk:** medium — content sourcing. Mechanically identical to Scrambled Word.

### 5. Synonyms  ·  Effort: **M**
- **Mechanic:** a word shown; players race to type a valid synonym; each correct synonym scores;
  faster + less-common scores higher. Config: obscurity, # answers required per round, dup handling.
- **Engine:** `SIMULTANEOUS` (+ optional multi-submit).
- **Reuses:** validation-service pattern (the *seam* + synonym-tolerant dup handling we built);
  scoring; persistence.
- **New:** a **synonym dataset/validation** — "is X a synonym of Y?" The PRD's original plan was
  dictionary + LLM fallback, but **you ruled out LLM in validation (Q4)**. So this needs a
  **curated synonym dataset** in Mongo (word → synonyms[]) to validate against.
- **Content:** **not free** — a thesaurus dataset (e.g. WordNet-derived).
- **Risk:** medium — content/dataset sourcing; without it the game can't validate.

### 6. Antonyms  ·  Effort: **M (≈free if Synonyms is built)**
- **Mechanic:** same as Synonyms, opposite relation.
- **Engine/Reuses/New:** *identical to Synonyms* — shares the dataset shape (word → antonyms[]) and
  the validation path. If Synonyms is built, Antonyms is a near-copy.
- **Content:** antonym dataset (same source as the thesaurus usually provides both).
- **Risk:** medium — same dataset dependency. **Pairs with Synonyms** (build both or neither).

### 7. Spelling Fast  ·  Effort: **M**
- **Mechanic:** a word is **read aloud via TTS on the display** (never shown); players race to type
  the correct spelling. Speed + accuracy. Configs: audio voice, replay allowance, autocorrect off.
- **Engine:** `SIMULTANEOUS`.
- **Reuses:** word DB for source words; exact-match validation (trivial); scoring; persistence.
- **New:** **TTS** — the `needsTTS` capability exists in the manifest but **nothing implements it.**
  The display must speak the word. That's a real new capability: either browser SpeechSynthesis
  (client-side, display device) or a server TTS pipeline. Server stays simple if we push TTS to the
  display client (server just sends the word to the *display only*, never players — answer secrecy).
- **Content:** *free* — word DB.
- **Risk:** medium — **first game needing the TTS capability** + a display-only secrecy nuance (the
  word goes to the display to speak, never to players). Good *new-capability* proof if you want it.

### 8. Typing Fast  ·  Effort: **M**
- **Mechanic:** a passage shown; players race to type it accurately; score = WPM × accuracy.
  Configs: passage length, accuracy-weight slider, passage source.
- **Engine:** `SIMULTANEOUS`.
- **Reuses:** content service; scoring; persistence. No validation engine — it's a
  character-diff/accuracy computation (in-state, pure).
- **New:** passage content (`typing_passage` kind) + a WPM/accuracy scorer (pure compute).
- **Content:** **light** — a set of passages (Nigerian lit / Bible / Pidgin / quotes), hand-authored
  or imported; smaller burden than definitions/thesaurus.
- **Risk:** low-medium. New scoring shape (WPM×accuracy) but no new infra.

### 9. Truth or Dare  ·  Effort: **M**
- **Mechanic:** round-robin; active player picks Truth or Dare on their phone; prompt shown on
  display; others **vote** whether they completed it; points for completion, bonus for daring.
  Config: voting threshold (majority/unanimous/any).
- **Engine:** `ROUND_ROBIN` + a voting sub-phase — *combines Word Bomb's turn rotation with Hot
  Take's voting.* Both patterns exist; this is the first to **compose** them.
- **Reuses:** round-robin turn engine; voting machinery; **content rating filter** (Truth/Dare
  prompts are the headline rating-filtered content — Family→Spicy→18+); persistence.
- **New:** a `truth_or_dare` prompt content kind (two pools: truths, dares; rating-tiered) + the
  compose of turn+vote. No new infra, but a new *composition*.
- **Content:** truth + dare prompt packs (hand-authored, rating-tiered) — moderate.
- **Risk:** low-medium. **Strong rating-filter showcase** (the spiciest content in the catalogue).

### 10. Catch the Lie  ·  Effort: **M**
- **Mechanic:** each player privately submits 2 truths + 1 lie about themselves; display reveals one
  player's statements anonymously; others vote which is the lie; points for guessing + for fooling.
- **Engine:** `SUBMIT_REVEAL` + voting — *like Hot Take's submit→reveal→vote, but turn-sequenced
  reveals (one player at a time) and the "content" is player-generated.*
- **Reuses:** submission + voting machinery; anonymity discipline (we already hide authorship);
  scoring; persistence.
- **New:** the two-phase (submit-all → reveal-each-in-turn → vote-per-reveal) flow; **no platform
  content at all** (player-generated) — so zero content burden.
- **Content:** *none* (player-generated).
- **Risk:** low. **Zero content cost**, exercises submit+turn-reveal+vote composition.

### 11. Presentation  ·  Effort: **M**
- **Mechanic:** each player gets a topic with **no prep**, presents aloud for a fixed duration
  (default 90s) while the topic shows on display; others rate across criteria
  (Persuasiveness/Entertainment/Confidence) + optional one heckle question; score = aggregate
  ratings + audience-favourite bonus.
- **Engine:** `ROUND_ROBIN` + **multi-criteria rating** (a richer vote — sliders per criterion, not
  a single pick).
- **Reuses:** round-robin; rating filter on topics; persistence.
- **New:** multi-criteria rating aggregation (Hot Take votes are single-pick; this is N ratings × M
  criteria) + a heckle sub-channel. Speaking happens IRL — server just times + collects ratings.
- **Content:** topic packs (rating-tiered) — light.
- **Risk:** low-medium. New *rating* shape (criteria sliders) beyond simple voting.

### 12. Millionaire  ·  Effort: **L**
- **Mechanic:** graduated-difficulty MCQ ladder; **rotational turns** (correct → ladder advances,
  next player; wrong → eliminated from the ladder); time-boxed; banked winnings win. **Lifelines:**
  50/50, Ask the Audience (poll all phones), Phone a Friend (assign to a player). Currency ladder.
- **Engine:** `ROUND_ROBIN` (rotational) — but with a **ladder state machine + lifelines** that are
  genuinely new mechanics (audience-poll mid-question is a nested simultaneous vote; 50/50 mutates
  the presented options; phone-a-friend delegates a turn).
- **Reuses:** MCQ content (Quizzes decks, difficulty-graded); turn engine; persistence.
- **New:** the ladder + **three distinct lifelines**, each its own mini-mechanic. Most complex
  non-AI game in the catalogue.
- **Content:** difficulty-graded MCQ ladders (Quizzes decks tagged by difficulty — partially reuses
  existing quiz content).
- **Risk:** **high** — lifelines (esp. Ask-the-Audience = a sub-poll mid-turn) are real new engine
  work. The marquee "Brain & Strategy" game but the heaviest build.

### 13. Investigation  ·  Effort: **L**
- **Mechanic:** a case (theft/murder/fraud…) on display; players explore case materials on their
  phones (suspects, transcripts, evidence, timeline) at their own pace within a time window; each
  privately submits an accusation; truth revealed; correct accusers score, bonus for fastest.
- **Engine:** `OPEN_PHASE` — **a mode we have NOT built.** Players read/explore freely (not
  turn-gated, not simultaneous-answer) then submit. New engine shape.
- **Reuses:** submission phase; AI service (for case *generation*, optional); persistence; rating
  filter.
- **New:** the **open-investigation phase** (per-player free navigation of case materials served
  by `view`), structured **case content** (the heaviest content in the catalogue — suspects,
  evidence, transcripts, the solution), and optionally AI case-generation (PRD §14 wants ~10 cases).
- **Content:** **heavy** — rich structured cases, hand-authored or AI-generated + reviewed.
- **Risk:** **high** — new engine mode (`OPEN_PHASE`) + the richest content model. The deepest
  "Immersive" game.

---

## Summary table

| Game | Mode | Effort | Content burden | New infra/risk |
|---|---|---|---|---|
| Bible Quiz | SIMULTANEOUS | **S** | scripture decks | none (≈ Quizzes variant) |
| Missing Letters | SIMULTANEOUS | **S** | free (word DB) | none |
| Scrambled Word | SIMUL+rank | **M** | free (word DB) | wires fuzzy engine to ranking |
| Definition Race | SIMUL+rank | **M** | definitions dataset | content sourcing |
| Synonyms | SIMULTANEOUS | **M** | thesaurus dataset | synonym dataset (no LLM) |
| Antonyms | SIMULTANEOUS | **M** | antonym dataset | ≈free if Synonyms built |
| Spelling Fast | SIMULTANEOUS | **M** | free (word DB) | **TTS capability** (new) |
| Typing Fast | SIMULTANEOUS | **M** | light (passages) | WPM/accuracy scorer |
| Truth or Dare | ROUND_ROBIN+vote | **M** | truth/dare packs | turn+vote compose; rating filter |
| Catch the Lie | SUBMIT_REVEAL+vote | **M** | **none** (player-gen) | turn-reveal compose |
| Presentation | ROUND_ROBIN+rating | **M** | light (topics) | multi-criteria rating |
| Millionaire | ROUND_ROBIN | **L** | reuses quiz decks | **lifelines** (heavy) |
| Investigation | OPEN_PHASE | **L** | **heavy** (cases) | **new engine mode** + content |

---

## Recommendation — the next best 5

Optimising for **most catalogue coverage per unit of new risk**, while still stretching the engine:

1. **Missing Letters (S)** — free content, new casual mechanic, near-zero risk. Easy win.
2. **Scrambled Word (M)** — free content; finally showcases the fuzzy/similarity engine we built
   but barely use; proves the ranking path with a second game.
3. **Catch the Lie (M)** — zero content burden (player-generated); proves submit→turn-reveal→vote,
   a composition nothing built yet covers.
4. **Truth or Dare (M)** — the strongest **content-rating** showcase (Family→18+ truths/dares),
   composes turn+vote; high player appeal for a party product.
5. **Spelling Fast (M)** — the one deliberate stretch: implements the **TTS capability** (declared
   in the manifest, never built) + the display-only answer-secrecy nuance. Free content.

**Why this set:** 3 of the 5 need **no new content** (Missing Letters, Scrambled Word, Catch the
Lie), 1 needs light rating-tiered packs (Truth or Dare), 1 stretches a genuinely new capability
(TTS). It avoids the two **L** games (Millionaire's lifelines, Investigation's new engine mode +
heavy cases) and the **dataset-blocked** games (Definition Race, Synonyms/Antonyms) — those are
better as a *later* wave once a thesaurus/definitions dataset is sourced.

**Alternative if you want depth over breadth:** swap Spelling Fast → **Millionaire** (the marquee
brain game) accepting the heavier lifelines build. Or swap in **Investigation** if proving the
`OPEN_PHASE` engine mode matters more than shipping volume now.

---

## Open questions for your pick

**Q1 — Bible Quiz: separate game or a Quizzes category?** It's mechanically Quizzes. Cheapest as a
Quizzes `category: bible` with translation/testament tags, vs. its own plugin for a distinct
catalogue entry. Which?

**Q2 — Datasets:** Definition Race needs definitions; Synonyms/Antonyms need a thesaurus. Do you have
a source (e.g. WordNet, a dictionary dump like the wordmaster `allwords`), or should those wait?

**Q3 — TTS placement (if Spelling Fast is picked):** client-side browser SpeechSynthesis on the
display device (server just sends the word to the display only), or a server TTS pipeline? Recommend
client-side — zero server cost, and keeps the word off players' phones (secrecy).

**Q4 — Confirm the 5.** Take my recommended set, the depth alternative (swap in Millionaire /
Investigation), or hand-pick from the table.
