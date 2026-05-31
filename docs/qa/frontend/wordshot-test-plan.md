# Wordshot — Rigorous Live Test Plan (Host + 2 Players + Display)

**Prepared:** 2026-05-31
**Scope:** Wordshot ONLY. Real multiplayer, multi-round, multi-surface, stress, refresh, disconnect/rejoin, navigation, config, and PRD-matchability. Other games come after Wordshot is solid.
**Why this plan exists:** the previous QA passed Wordshot by reading the DOM once after each action. It missed host-can't-play, state-propagation latency, display-not-advancing, stuck-after-submit, and the back-button stack — because those are *timing* and *cross-surface* bugs that a single `eval` snapshot cannot see. **Every test here is observed live, across all surfaces at once, with timing measured.**

**Surfaces (4 concurrent, isolated sessions — never same browser profile):**
- **HOST** — creates the room; we test BOTH host-play paths (see "Host-as-player" below).
- **P1, P2** — two normal players (incognito / named sessions).
- **DISPLAY** — the shared screen (`/display/:code` and `/d/:code/game?live=wordshot`).

**Host-as-player — test both, the app must make ONE of them work cleanly (PRD §3: "Host plays as a regular player from their phone"):**
- **Path A — host's own tab plays:** host lands on `/host/room/:code/game` after Start and is expected to see the question + input + score, same as a player.
- **Path B — host opens a separate player seat:** host also joins via `/join/:code` in another tab and plays there.

**PRD reference (§6.1 Wordshot):** "A random letter and a random category appear on the display ('A, Foods'). Players race to type a valid answer that starts with that letter and fits the category. Answers validated by the Wordshot validation engine. Faster correct = more points. Mode: Simultaneous-answer. Min 2, Max soft 10."

**Tooling rules (so we don't repeat past mistakes):**
- Drive each surface in its **own `agent-browser --session`**; keep all open simultaneously.
- After EVERY state-changing action, **read all 4 surfaces** and record what each shows + a **timestamp**. Latency is a result, not a footnote.
- **Screenshot** every phase on every surface (the bug is often visual: stuck spinner, frozen QR).
- Measure propagation: `t_action` → `t_surface_reflects`. Anything > **2s** is a finding; > **5s** is a P1.
- Watch `agent-browser console` + `errors` per surface for socket churn / exceptions.
- Use real words that fit the category (validator is `far-offs.ts` category-distance — wrong category scores 0). Keep a per-category word bank.

---

## 0. Root-cause hypotheses to confirm/refute (built from source review)

These are the mechanisms behind the reported bugs. Each test phase below is designed to prove or kill one.

| Hyp | Mechanism | Predicts | Confirm in |
|-----|-----------|----------|-----------|
| **H1** | Host joins socket as `role=host` but renders `patches[Audience.PLAYER]`; backend may not send player-audience patches to a host socket. | Host stuck on "Starting the round…"; question lands late or never. | Phase HP |
| **H2** | Host join sends `reconnectToken = hostToken` (not a player reconnect token) → backend doesn't seat host as a player. | Host never scores; host absent from player count. | Phase HP |
| **H3** | Display auto-advance only fires on a non-lobby patch to the **display socket**; backend may not push display view promptly on start. | Display stuck on QR / "Waiting · N joined" after game starts. | Phase DS |
| **H4** | Roster from `useLobby` (REST, `staleTime 2s`, **no refetchInterval**); socket not used for roster. | Player count frozen until reload across host/player/display lobbies. | Phase RL |
| **H5** | `WordPlayer` clears input on submit; no optimistic "submitted" state; score waits for next patch. | "Submitted but UI stuck / nothing happens." | Phase SUB |
| **H6** | All nav is `push` (`go()`/`navigate()`), incl. configure round-trip; nothing uses `replace`. | Back button walks a deep stack ("infinite back"). | Phase NAV |
| **H7** | `RoomSocketProvider` effect re-runs on `roomCode/role/token` change but same-route remount may not tear down cleanly. | Stale game state when switching rooms/games in-tab. | Phase REJOIN |
| **H8** | First patch can arrive before `detectLiveGame` has a shape; `?live=` hint covers chrome only. | Brief blank/"Waiting…" even when live. | Phase RND |

---

## Pre-flight

| ID | Step | Expected |
|----|------|----------|
| PF-1 | Backend up: `GET /api/v1/health` → ok | `{status:"ok"}` |
| PF-2 | Game dev up at :5173 | HTML |
| PF-3 | Wordshot content seeded (categories: name/food/country/city/animal/company/app/currency/…). Verify via admin Content → Words, or a probe start. | categories resolve, game starts |
| PF-4 | 4 isolated browser sessions ready: `host`, `p1`, `p2`, `disp`. | `agent-browser --session <x>` each |
| PF-5 | Per-category word bank loaded (for valid submissions). | e.g. food→Akara, country→Nigeria, animal→Antelope, city→Aba, name→Ada |

**Driving rig (the canonical setup every phase starts from):**
1. HOST: `/host/new` → Quick Play → real room `:code` (capture it). Confirm 6-char, not GBE-4ZK.
2. P1: `/join/:code` → nickname "Ada" → `/lobby/:code`.
3. P2: `/join/:code` → nickname "Bola" → `/lobby/:code`.
4. DISPLAY: `/display/:code` (shared screen).
5. HOST: Pick a game → Wordshot → Configure → Add to room → ▶ Start.

---

## Phase RL — Lobby roster live-update (before any game) · confirms H4

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| RL-1 | Open HOST lobby + DISPLAY lobby with only host present. | Both show "1 joined" / host pill. | — |
| RL-2 | P1 joins. **Without reloading**, watch host + display rosters for 10s. | P1 appears on BOTH within ~2s. | **BUG (H4):** appears only after manual reload. Measure delay. |
| RL-3 | P2 joins. Same watch. | "3 joined", P2 pill on all surfaces. | frozen count |
| RL-4 | P1 leaves (Leave room). | P1 disappears from host/display within ~2s. | stale pill |
| RL-5 | Player count consistency: host vs display vs player lobby all agree. | identical counts. | divergence |
| RL-6 | Late joiner during lobby (P3 joins 30s later). | appears live. | frozen |

---

## Phase HP — HOST AS PLAYER (the headline bug) · confirms H1, H2

Run BOTH paths. The host MUST be able to play per PRD §3.

### Path A — host plays from its own /host/room/:code/game tab
| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| HP-A1 | Host ▶ Start Wordshot → host lands on `/host/room/:code/game`. Screenshot immediately + at t+1s, +3s, +5s, +10s. | Host sees the **letter + category + input** (the live `WordPlayer`) within ~2s. | **BUG (H1):** stuck on "Starting the round…" — record how long until (if ever) the question lands. This is your screenshot. |
| HP-A2 | Host submits a valid answer. | Host score increases; "Submitted" feedback. | host can't submit / score never moves (H2) |
| HP-A3 | Is the host counted as a player? Compare display roster + scoreboard. | Host appears as a scoring participant. | host absent → H2 confirmed |
| HP-A4 | Compare host's letter/category to P1/P2/DISPLAY at the same instant. | All four identical. | host sees stale/old round |
| HP-A5 | Measure host patch latency vs players across 3 rounds: t(player sees round N) vs t(host sees round N). | within ~1s of each other. | **BUG:** host lags by Xs (your "lands much later") — quantify X. |
| HP-A6 | Host "Skip" / "End game" controls fire while host is mid-play. | actions emit; engine responds. | controls dead / crash |

### Path B — host opens a separate player seat (/join/:code in another tab)
| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| HP-B1 | Host (already host) opens `/join/:code` in a 2nd tab, nickname "HostPlays". | joins as a normal player; appears in roster. | join blocked / dup-session clobber |
| HP-B2 | Start the game; the host-player tab behaves exactly like P1. | live round + input + score. | stuck (compare to HP-A1) |
| HP-B3 | Does the same browser profile clobber the host session? (sessionStorage shared) | incognito isolates; same-profile may clobber — document. | reconnect token overwrite |

> **Verdict gate:** if NEITHER path lets the host play a full round with scoring, that's the #1 P0 — Wordshot fails the PRD's core "host plays too."

---

## Phase DS — DISPLAY advance + live render · confirms H3, H8

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| DS-1 | DISPLAY sitting on `/display/:code` (QR lobby). Host starts Wordshot. Screenshot display at t+1s,+3s,+5s,+10s,+20s. | Display **auto-advances** off the QR to the live board (letter + category + submission feed) within ~3s. | **BUG (H3):** display stuck on QR / "Waiting · N joined" — this is your reported bug. Record time-to-advance (or "never"). |
| DS-2 | Direct display URL `/d/:code/game?live=wordshot` opened AFTER start. | renders live opening immediately (hint covers chrome, patch fills in). | stuck "Setting up…" / blank |
| DS-3 | Display shows the public Wordshot view per PRD: the **letter + category** big, and a live submission feed of who answered. | letter+category hero + feed. | missing letter/category, or shows player input controls (wrong projection) |
| DS-4 | Display NEVER shows a player's actual answer text or the "correct" answer before reveal (PRD secrecy). | only names/"answered" pre-reveal. | answer leak |
| DS-5 | Across a round: display letter/category == host == P1 == P2 at the same instant. | all four agree. | display lags / shows old round |
| DS-6 | Round advances on display (round 1→2→3 …) in lockstep with players. | counter increments live. | frozen round number |

---

## Phase SUB — Submission UX (stuck-after-submit) · confirms H5

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| SUB-1 | P1 types a **valid** word (fits letter+category) and submits. | input clears AND a clear "Submitted ✓ / locked" state appears immediately; score updates when the round resolves. | **BUG (H5):** input clears but no feedback — looks frozen/stuck. |
| SUB-2 | P1 submits an **invalid** word (wrong letter or category). | clear rejection / 0, not silent. | silent void |
| SUB-3 | P1 submits, then tries to submit again same round. | blocked or replaces, with feedback — not a dead button. | double-submit / nothing |
| SUB-4 | Empty submit. | blocked, no emit. | empty emit |
| SUB-5 | Submit then wait for next round: does the input reset and re-enable for round N+1? | fresh input each round. | stuck disabled / keeps old text |
| SUB-6 | Measure: t(submit) → t(score or feedback visible). | < 2s. | > 2s = laggy; quantify |
| SUB-7 | Rapid valid submits across rounds (P1 every round, P2 every other). | scores diverge correctly; no UI lock. | UI freezes after N submits |
| SUB-8 | Long input (200+ chars), emoji, leading/trailing spaces, unicode. | trimmed/handled, no crash. | crash / accepts junk |

---

## Phase RND — Multi-round correctness · confirms H8 + scoring

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| RND-1 | Play a FULL game (all rounds, default config) with P1+P2 both answering every round. | rounds advance; each valid answer affects score; game reaches a terminal board. | stalls mid-game |
| RND-2 | Letter+category actually change each round and are valid Wordshot prompts. | new letter/category per round. | repeats / blank |
| RND-3 | Faster correct answer scores higher (PRD speed weighting): P1 answers fast, P2 slow, both valid. | P1 > P2 for that round. | no speed weighting |
| RND-4 | Reveal phase between rounds shows the ranked answers (not "…"). | populated reveal. | **BUG:** blank "…" reveal (known K4/BUG-06). |
| RND-5 | Final leaderboard at game end shows real names + scores across host+P1+P2 on display + player result. | live final board, not mock "Ada 1420 / Tobi 1180". | **BUG:** mock result (known K5). |
| RND-6 | Player result screen `/p/:code/result` matches the display final board. | consistent, real scores. | mock / mismatch |
| RND-7 | "You came Nth" on player matches their actual rank. | correct rank. | fabricated |

---

## Phase CFG — Config matchability (PRD §7) · does config do anything?

PRD Wordshot configs: **Round count**, **Time per round**, **Enabled categories** (multi-select + custom), **Letter difficulty** (Common only / Includes Q-X-Z / Mixed), plus universal: difficulty, scoring mode, wrong-answer penalty, duplicate-answer handling, leaderboard cadence.

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| CFG-1 | Set **Round count = 3**, start, count actual rounds. | exactly 3 rounds. | **BUG (known K3):** config ignored (`buildStartConfig()` returns `{}`). Confirm and quantify which configs are dropped. |
| CFG-2 | Set **Time per round = 10s**; measure actual round duration. | ~10s. | ignored |
| CFG-3 | **Enabled categories** = only "Foods"; play 5 rounds. | every round is a food category. | other categories appear |
| CFG-4 | **Letter difficulty = Includes Q-X-Z**; observe letters. | hard letters appear. | ignored |
| CFG-5 | **Duplicate-answer handling = Strict**: P1 & P2 submit the SAME valid word; only first scores. | only first scorer. | both score / engine default |
| CFG-6 | Inspect the actual `POST /rooms/:code/start` body for a `config` field. | config present if UI claims effect. | empty `{}` → config is theatre (document every control that lies). |
| CFG-7 | "Use defaults" path vs customized path produce different games. | observable difference. | identical → config dead |

> Every config control that visibly changes in the UI but has **no live effect** is a P2 "lying control" — list them all.

---

## Phase NAV — Navigation & the "infinite back" · confirms H6

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| NAV-1 | From host-game, press browser Back once. | goes "up" one logical step (lobby), not into a stale mid-flow screen. | lands on a dead/duplicate screen |
| NAV-2 | Count history depth after the full host flow (new→lobby→catalogue→configure→lobby→game). Press Back repeatedly. | a sane number of steps to landing (≤ ~4); no loops. | **BUG (H6):** many redundant entries; configure round-trip pushed lobby twice; "infinite back." Record exact stack. |
| NAV-3 | After Add-to-room returns to lobby, Back. | doesn't bounce between configure↔lobby. | bounce loop |
| NAV-4 | Player Back from `/p/:code/game` mid-round. | leaves cleanly (or warns), socket closes. | stuck / ghost socket |
| NAV-5 | Display Back from `/d/:code/game`. | returns to display lobby without breaking the live socket for others. | breaks room |
| NAV-6 | Forward after Back re-enters correctly. | consistent. | broken forward |
| NAV-7 | `AppHeader` back arrow vs browser Back — do they agree? | consistent target. | divergent |
| NAV-8 | Deep-link directly to `/p/:code/game` (no history) then Back. | sane fallback (landing), not blank. | blank/crash |

---

## Phase REFRESH — Refresh resilience (every surface, every phase) · partly H7

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| REF-1 | Refresh P1 mid-round. | rejoins same seat (reconnect token), same score, live round within ~3s. | lost seat / score reset / stuck |
| REF-2 | Refresh HOST mid-round (Path A). | host returns to its play+controls, still seated, score intact. | host demoted / can't rejoin / stuck "Starting…" |
| REF-3 | Refresh DISPLAY mid-round. | returns straight to live board (not back to QR lobby). | **BUG:** bounces to QR / loses game. |
| REF-4 | Refresh P1 during reveal phase. | shows reveal/holding correctly. | blank |
| REF-5 | Refresh all 3 players simultaneously mid-round. | all rejoin; round continues. | room wedges |
| REF-6 | Refresh P1 on the final leaderboard. | still shows final, not a reset lobby. | loses result |
| REF-7 | Measure rejoin time after refresh per surface. | < 3s. | quantify slow rejoins |

---

## Phase DISCO — Disconnect / reconnect / rejoin · confirms H7

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| DIS-1 | Kill P1's network mid-round (offline), 5s, restore. | "Reconnecting…" then live again, same seat. | stuck reconnecting / new seat |
| DIS-2 | Kill network through a round boundary (offline during round 2, back in round 3). | catches up to current round. | shows stale round 2 forever |
| DIS-3 | Close P1 tab entirely, reopen `/p/:code/game`. | reclaims seat via stored token. | new player / lost score |
| DIS-4 | Host disconnects mid-game (Path A): does room suspend? (PRD §10: 60s grace). | players see suspended/grace, then resume or end. | silent freeze / no grace UX |
| DIS-5 | P2 leaves permanently mid-game (PRD §10: turn auto-skipped, score preserved). | game continues with remaining; P2 score kept. | game stalls waiting on P2 |
| DIS-6 | Switch room in same tab: from this game to a NEW room's `/p/:code2/game` without reload. | new room state, not stale old game. | **BUG (H7/BUG-05):** shows previous game until hard reload. |
| DIS-7 | Backend bounce (stop+start backend) mid-game. | clients show reconnecting, recover to a sane state. | permanent error / crash |

---

## Phase STRESS — Load & chaos

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| STR-1 | 3 players all submit within the same 200ms window every round. | all register; no dropped submits; scores correct. | dropped/duplicated submits |
| STR-2 | Rapid-fire: one player submits → resubmits → submits next round, as fast as possible. | rate-limited or queued gracefully (PRD §14 mentions rate limit). | UI lock / crash |
| STR-3 | Spam Start: host clicks ▶ Start multiple times fast. | one game starts (`game_already_running` for the rest). | double-start / two instances |
| STR-4 | Add 8–10 players (near soft cap 10), play a round. | all see rounds; submissions register; UI stays responsive. | lag / cap behavior (spectators per PRD §4)? |
| STR-5 | Exceed soft cap (11+). | overflow handling per PRD (host picks / spectators), or graceful. | crash / silent drop |
| STR-6 | Leave + rejoin churn during active rounds (players in/out repeatedly). | roster + scores stay consistent. | desync |
| STR-7 | Long session: play 3 full Wordshot games back-to-back in the same room. | no memory/socket leak; each game clean. | degradation, ghost sockets (check `console`) |
| STR-8 | Two displays on the same room. | both mirror identically. | divergence |

---

## Phase USAB — Usability & visual (watch, don't just read DOM)

| ID | Test | Expected | Failure = bug |
|----|------|----------|---------------|
| USA-1 | Every surface, every phase: screenshot and eyeball — is anything a stuck spinner, blank card, or frozen state? | clear, correct state. | the visual bugs `eval` misses |
| USA-2 | Loading states: is "Starting the round…" ever permanent? Time it out at 10s. | resolves quickly. | permanent spinner = P1 |
| USA-3 | Input focus/keyboard on player (mobile viewport): can you type + submit smoothly? | yes. | focus loss, keyboard covers input |
| USA-4 | Display readable as a TV (large text, letter/category prominent, landscape)? | yes per PRD §12. | tiny/cramped |
| USA-5 | Timer visible + counting on all surfaces during a round? | yes, in sync. | missing/desynced timer |
| USA-6 | Score/round indicators present and correct on each surface. | yes. | missing |
| USA-7 | Error/empty states: bad room, room ended mid-game, kicked — clear messaging, no blank. | coded message. | blank/crash |
| USA-8 | Mobile (P1/P2 at 390px) vs display (1280px+) both usable. | responsive. | broken layout |

---

## Phase PRD — Spec matchability (Wordshot §6.1 + §7)

| ID | PRD requirement | Pass condition |
|----|-----------------|----------------|
| PRD-1 | Letter + category shown **on the display**. | DS-3 passes. |
| PRD-2 | Players type on phones; answer must start with the letter AND fit the category. | validator enforces both (SUB-2). |
| PRD-3 | Validated by the Wordshot validation engine (real word + letter + category). | invalid words rejected. |
| PRD-4 | Faster correct = more points. | RND-3 passes. |
| PRD-5 | Simultaneous-answer mode (everyone answers at once, not turn-based). | all players input concurrently. |
| PRD-6 | Min 2 players enforced; soft max 10. | start <2 blocked; 10+ handled. |
| PRD-7 | Host can play as a regular player. | Phase HP passes (A or B). |
| PRD-8 | Spectators over cap see state but can't submit (§10). | STR-5. |
| PRD-9 | Configs (round count, time, categories, letter difficulty) take effect. | Phase CFG. |
| PRD-10 | Display-less fallback: host phone shows game state if no display (§5). | host sees public state somewhere. |

---

## Execution order

1. **Pre-flight** + rig up all 4 surfaces.
2. **RL** (roster) → **HP** (host-as-player — the headline) → **DS** (display advance). These three are where your reported bugs live; do them first and thoroughly.
3. **SUB** (submission UX) → **RND** (multi-round + scoring).
4. **CFG** (config matchability).
5. **NAV** (back stack) → **REFRESH** → **DISCO**.
6. **STRESS** → **USAB** → **PRD** matchability sign-off.

## What "done" means for Wordshot
A full game where: host + 2 players all play and score live; display advances off the QR within 3s and mirrors every round; submissions give immediate feedback; rounds + reveal + final board are all live (no mock, no "…"); configs that the UI exposes actually change the game; refresh/disconnect/rejoin recover every seat; and Back behaves sanely. Until then, Wordshot is not shippable — and we don't move to the next game.

---

## Reporting format (per test)
```
[ID] PASS/FAIL  | t_action=… t_host=… t_p1=… t_p2=… t_disp=…  (latencies)
  HOST:    <what its screen showed>      DISPLAY: <…>
  P1:      <…>                           P2:      <…>
  Screenshot: <file>
  If FAIL: observed vs expected; which hypothesis (H1–H8) it confirms; mechanism if known.
```
Latencies are first-class. "It works but the host's round lands 8s late" is a FAIL, not a footnote.
