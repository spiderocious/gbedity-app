# Spec — Animated game flow for all 18 games

**Status:** spec · awaiting review (no code yet)
**Builds on:** the shipped Missing Letters flow (`features/in-game/games/missing-letters/`) — that is
the proven reference. This spec generalizes it to the other 17 games.
**Source of truth:** the per-game plugins (`apps/backend/src/games/*`) + `game-engine.md`. Where this
spec and a plugin disagree, the plugin wins — flag the drift.

---

## 0. The thesis (what "the Missing Letters flow" actually is)

The reference flow is a **client-side stage machine layered over backend phases**, rendered through a
shared toolkit, identical for player / host / spectator (only rendering differs by audience). The
backend stays a pure state machine; the client choreographs the *experience* around its phases.

The reusable contract we already have (`features/in-game/flow/`):
- **Stage primitives:** `StageTransition` (keyed cross-fade), `CountdownNumerals`, `CountdownRing` +
  `TimerBar` (both drain from the backend `deadline`, show live seconds), `GoTransition`,
  `LetterSlots`, `RoundScores`, `useCountdown`, `useTimeout`, `useOnMount`.
- **The lifecycle the flow always has:** `intro → countdown → (per round: round_start → playing →
  reveal → round_scores) → done`, with two locked rules learned the hard way:
  1. **Backend-authoritative.** The intro/countdown are a brief cosmetic overlay that ends the moment
     the first real patch arrives; every backend phase maps straight to a stage. Interstitial timers
     never gate the live phase (that caused the "host stuck on GO!" desync).
  2. **First round goes straight to the word** (no flash) so host+players sync to the backend
     `deadline`. Later rounds get the brief `GoTransition` flash.
- **Game-over → result** (`game-result.tsx` + `result-store`), and **all scores from the patch
  `board`** (cumulative totals + round delta), winner only when score > 0.

**So "give every game the flow" = three things:**
A. **Backend:** every plugin's `view()` must project the timing + scores the flow needs.
B. **A registry + per-game flow modules** on the client (replace the hardcoded `=== MISSING_LETTERS`).
C. **A small set of new shared stage primitives** for the input/display shapes the 5 modes need
   (MCQ, ranked feed, turn-holder, submission grid, vote, case file) — built once, reused across games.

---

## 1. The 18 games, grouped by mode (audited from source)

Every game is `round/phase → reveal → done` shaped. Player limits + capabilities noted where they
change the flow. **★ = already projects `deadline`+`secondsPerRound`+`board` in `view()` (only
Missing Letters today).**

### A. Simultaneous — "everyone answers the same prompt at once" (8 games)
| Game | phases | action | key view fields | answer-secret |
|---|---|---|---|---|
| **Missing Letters ★** | round/reveal/done | `missing_letters.guess` | masked, length, answer(reveal), board, deadline | answer |
| Quizzes | question/reveal/done | `quizzes.answer` | prompt, options[], qIndex, answerIdx(reveal), answered | answerIdx |
| Bible Quiz | question/reveal/done | `bible_quiz.answer` | prompt, options[], qIndex, answerIdx(reveal), answered | answerIdx |
| Spelling Fast | round/reveal/done | `spelling_fast.spell` | speak(TTS), voice, replaysAllowed, length, answer(reveal), solved | the word (never shown — TTS) |
| Typing Fast | round/reveal/done | `typing_fast.submit` | passage, submitted | — (passage is shown) |
| Wordshot | round/reveal/done | `wordshot.submit` | letter, category, ranked[] (live top-N), yourScore, yourSubmission | — (live ranked feed) |
| Scrambled Word | round/reveal/done | `scrambled_word.guess` | scrambled, ranked[], answer(reveal), yourClosest | answer |
| Definition Race | round/reveal/done | `definition_race.guess` | definition, ranked[], answer(reveal), yourClosest | answer |
| Synonyms / Antonyms | round/reveal/done | `relation.submit` | prompt, relation, acceptedCount, yourAccepted | — |

These are **the closest to Missing Letters** — same shape, just different prompt+input. The two
sub-shapes: *type-the-answer* (ML, Spelling, Scrambled, Definition, Relation) and
*pick/compose* (Quizzes/Bible = MCQ, Typing = passage copy, Wordshot = letter+category, with a live
ranked feed for Wordshot/Scrambled/Definition).

### B. Round-robin — "turn passes between players" (4 games)
| Game | phases | action(s) | key view fields |
|---|---|---|---|
| Word Bomb | holding/await_validation/between/done | `word_bomb.submit` | round, category, holderId, used[], yourTurn(player) |
| Truth or Dare | choose/vote/done | `truth_or_dare.choose`, `.vote` | round, holderId, choice, prompt(vote), yourTurn/voted(player) |
| Presentation | present/rate/done | `presentation.rate`, `.heckle` | round, presenterId, topic, heckles[], yourTurn(player) |
| Millionaire | question/audience_poll/phone_wait/reveal/done | `millionaire.*` (answer, lifeline_*) | qIndex, rung, ladder, holderId, prompt, options[], hiddenOptions(50/50), eliminated, banked |

Round-robin adds a **turn concept**: the flow needs a "your turn / waiting on X" beat and a holder
spotlight. Millionaire is the most complex (lifelines, ladder, sub-phases).

### C. Submit-then-reveal / vote (3 games)
| Game | mode | phases | action(s) | key view fields |
|---|---|---|---|---|
| Catch the Lie | submit_reveal | submission/reveal/done | `catch_the_lie.submit`, `.vote` | revealIdx, totalSubjects, statements(reveal), scores, submitted/voted/isYou(player) |
| Hot Take Court | submit_vote | submission/voting/reveal/done | `hot_take.submit`, `.vote` | prompt, defences[] (anon), roundIndex |
| Plead Your Case | submit_reveal | writing/evaluating/reveal/done | `plead.submit`, `.override` | scenario{charge,defendant,facts,laws,precedents} (needsAI) |

These have a **two-act rhythm**: a private submission phase (everyone writes) → a public reveal/vote
phase. The flow's "playing" splits into *compose* then *vote/reveal*.

### D. Open-phase / immersive (1 game)
| Game | mode | phases | action | key view fields |
|---|---|---|---|---|
| Investigation | open_phase | investigate/reveal/done | `investigation.accuse` | title, brief, suspects[], evidence[], timeline[] |

A single long self-paced phase (browse the case) → accuse → reveal. No per-round loop.

---

## 2. The backend gap (must close, per game) — A

**Today only Missing Letters projects what the flow consumes.** Every plugin holds `deadline` in
state, but `view()` doesn't surface it (or the scores) for the other 17. Without this, the flow has
no timer and no live scores. So **each plugin's `view()` gains** (mirroring `missing-letters.plugin.ts`):

1. **`deadline` (epoch-ms)** + the active phase's seconds (`secondsPerRound` / `secondsPerTurn` /
   `secondsPerPhase`) — drives `CountdownRing`/`TimerBar`. The values already exist in state.
2. **`board`** — cumulative `[{ playerId, points, roundDelta }]`, sorted — drives the all-players
   scores + round-scores screen + the final result. Pattern: keep a running `totals` map in State,
   fold `scoreRound` deltas in at the reveal transition, project sorted. (ML is the template; a few
   games already keep a `scores`/`banked` map — reuse it.)
3. **`yourScore`** on the PLAYER projection (already done by some).

This is **mechanical, per-game, low-risk** (no logic change — additive projection). It is the bulk of
the backend work and is **prerequisite** for each game's flow. Order it with the game's flow build.

*No new backend phases* — interstitials stay frontend-driven (confirmed by the ML build + wordmaster
study). The one shared addition already exists: the `server.game_over` signal + engine host controls.

---

## 3. The client architecture — B + C

### 3.1 A flow registry (replaces the hardcoded `=== MISSING_LETTERS`)
Today all three screens hardcode `const flow = backendId === LiveGameId.MISSING_LETTERS`. That doesn't
scale. Introduce:

```
features/in-game/flow/flow-registry.ts
  getGameFlow(backendId): GameFlowComponent | undefined
```
Each game registers a flow component keyed by its backend `gameId`. The host/player/display screens
become:
```tsx
const Flow = getGameFlow(backendId);
return Flow ? <Flow patch={...} send={...} audience={...} code={code} /> : <FallbackRenderer .../>;
```
One change in three screens; every game's flow is then just a registry entry. The existing
`live-renderers.tsx` map is the fallback for games without a bespoke flow yet (so nothing regresses
mid-migration).

### 3.2 The shared `GameFlowProps` contract
Every game flow is `(patch, send, audience, code) => JSX` — the exact `MissingLettersFlow` signature.
A shared `useGameFlow(patch, opts)` generalises `useMissingLettersFlow`: the stage machine
(`intro → countdown → round_start → playing → reveal → round_scores → done`) is **identical**; only
the per-phase backend phase-name mapping differs. So `useGameFlow` takes a small config:
```ts
useGameFlow(patch, {
  playingPhases: ['round'],         // backend phases that mean "active play"
  revealPhases: ['reveal'],
  donePhases: ['done'],
  roundKey: 'idx',                  // which patch field increments per round (idx/round/qIndex/roundIndex)
})
```
This collapses 18 near-duplicate stage machines into one + a tiny per-game config. (Missing Letters'
hook becomes the first caller; its behaviour is preserved exactly.)

### 3.3 New shared stage primitives (build once, reuse) — C
The reference covers type-the-word. The other modes need a handful more, all in `flow/`:
- **`McqOptions`** (Quizzes, Bible, Millionaire): A–D option tiles, tap-to-answer, lock + reveal
  correct/incorrect colour. (A basic one already exists in `content-primitives`; promote/refit.)
- **`RankedFeed`** (Wordshot, Scrambled, Definition): the live top-N closeness feed that updates as
  submissions land (`ranked[]`), with the player's own private result.
- **`TurnSpotlight`** (Word Bomb, Truth or Dare, Presentation): "It's {holder}'s turn" hero +
  "waiting on them" for everyone else; `yourTurn` flips it to the input.
- **`SubmissionGrid` + `VotePanel`** (Catch the Lie, Hot Take Court): the compose beat (textarea +
  "submitted ✓ / waiting on N") then the anonymous reveal/vote beat (tap a card to vote).
- **`CaseFile`** (Investigation): tabbed suspects/evidence/timeline browser + an accuse action.
- **`AudioPrompt`** (Spelling Fast, `needsTTS`): play/replay button (the word is never shown).
- **`VerdictPanel`** (Plead Your Case, `needsAI`): the "evaluating…" beat → AI rubric breakdown.

Each is reduced-motion gated and audience-aware (interactive for player/host, read-only-big for
spectator), exactly like `LetterSlots`/`TimerBar`.

### 3.4 Per-game flow module (the repeatable unit)
For each game: `features/in-game/games/<game>/<game>-flow.tsx` + (if its stage timing differs)
`use-<game>-flow.ts` that just calls `useGameFlow` with the game's config. The module composes the
shared primitives per phase — e.g. Quizzes' `playing` = `McqOptions`; Word Bomb's = `TurnSpotlight` +
input; Hot Take's `playing` = `SubmissionGrid` then `VotePanel` on the `voting` phase. Register it in
`flow-registry.ts`. **This is the same shape as Missing Letters — copy it.**

### 3.5 Audience + controls (already solved — reuse)
`audience: 'player'|'host'|'spectator'` + `HostControlStrip` (per-game controls via `hostControlsFor`)
+ the spectator routing already work generically. Each new game just needs its `hostControlsFor`
entry (which controls it exposes — e.g. Skip turn for round-robin).

---

## 4. Build order (one game at a time, lowest-risk first)

The simultaneous family (B) reuses the most of Missing Letters, so do it first; immersive last.

1. **Wave 1 — type/MCQ simultaneous:** Quizzes, Bible Quiz (MCQ), Scrambled Word, Definition Race,
   Synonyms/Antonyms (type-the-word, like ML). *Backend §2 per game + a flow module each.* Builds
   `McqOptions` + `RankedFeed`.
2. **Wave 2 — special simultaneous:** Wordshot (ranked + validation), Typing Fast (passage), Spelling
   Fast (TTS `AudioPrompt`).
3. **Wave 3 — round-robin:** Truth or Dare, Word Bomb, Presentation (builds `TurnSpotlight`), then
   Millionaire (ladder + lifelines — its own bigger module).
4. **Wave 4 — submit/vote:** Catch the Lie, Hot Take Court (builds `SubmissionGrid`+`VotePanel`).
5. **Wave 5 — immersive:** Plead Your Case (`VerdictPanel`, AI), Investigation (`CaseFile`).

Each game = backend `view()` projection + a flow module + a registry entry + `hostControlsFor` entry.
Ship + verify per game (typecheck/lint/tests green; the screens-smoke covers mount).

---

## 5. What we explicitly reuse (no rebuild)
- The whole `flow/` toolkit, `useGameFlow` (generalized from ML), `game-result.tsx` + `result-store`,
  `RoundScores`, the audience model, `HostControlStrip`, `WaitingForRound`, the `server.game_over` →
  result navigation, the room-gone guard, sound keys.
- The backend engine, sessions, gateway, host controls, spectator model — all game-agnostic already.

## 6. Open confirms before build
1. **`useGameFlow` generalization** — refactor `useMissingLettersFlow` into the shared
   config-driven hook now (clean base for all 18), or leave ML as-is and write the shared hook
   alongside? *(Recommend refactor — one stage machine, ML as first caller.)*
2. **Backend `board` projection** — do it per-game in each plugin (ML pattern), or add a runtime
   helper that derives `board` from the session leaderboard so plugins don't each re-implement it?
   *(Recommend a runtime/`ViewCtx` helper — kills 18× duplication; ML migrates to it too.)*
3. **Scope of first PR** — all of Wave 1 (5 games) together, or one game end-to-end (Quizzes) as the
   pattern-proof, then the rest? *(Recommend Quizzes first as the second proof after ML, then batch.)*
4. **Live-renderers fallback** — keep the current per-game `RENDERERS` map as the fallback during
   migration (recommended), and delete each entry as its bespoke flow lands.

## 7. Done when (per game) / overall
- Per game: backend `view()` projects `deadline`+phase-seconds+`board`; a flow module renders
  intro→countdown→rounds→reveal→round_scores→done for player/host/spectator; host controls correct;
  result screen shows the real board; typecheck/lint/tests green.
- Overall: `getGameFlow` covers all 18; no hardcoded `=== MISSING_LETTERS`; the `flow/` primitive set
  covers all 5 modes; one consistent animated experience across the catalogue.
