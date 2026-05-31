# Gbedity Backend — API Reference

**Base URL:** `http://localhost:8090/api/v1`
**WebSocket:** Socket.IO on the same origin (`http://localhost:8090`)
**Envelope:** success `{ "data": ... , "meta?": {...} }` · error `{ "error": { "code", "message", "field_errors?" } }`
**Auth:** `Authorization: Bearer <accessToken>` (admin endpoints). Host endpoints issue tokens but
only the room/play flow is unauthenticated for players.
**Pagination:** cursor-based — `?limit=&cursor=`; response `meta: { next_cursor, has_more }`.

> Clients switch on `error.code` (stable), never on `message` (human text, may change).

---

## Error codes (stable)

`validation_error` · `not_found` · `bad_request` · `conflict` · `rate_limited` · `forbidden` ·
`invalid_credentials` · `token_invalid` · `token_expired` · `session_revoked` · `unauthorized` ·
`room_not_found` · `room_full` · `room_closed` · `nickname_taken` · `not_in_lobby` ·
`game_not_found` · `not_host` · `not_enough_players` · `game_already_running` · `internal_error`

---

## Health

### `GET /health`
Unauthenticated. → **200** `{ status, service, env, time }`.

---

## Rooms (players — unauthenticated)

### `POST /rooms`
Create a room.
**Body** `{ "nickname": string }`
**201** `{ "data": { "code", "hostId", "hostToken", "display_url", "join_url" } }`
**422** `validation_error` (missing nickname).

### `GET /rooms/:code`
Lobby snapshot.
**200** `{ "data": { "code", "phase", "players": [{ "id", "nickname" }] } }`
**404** `room_not_found`.

### `POST /rooms/:code/players`
Join a room's lobby.
**Body** `{ "nickname": string }`
**201** `{ "data": { "code", "playerId", "reconnectToken" } }`
**404** `room_not_found` · **409** `room_closed` | `not_in_lobby` | `room_full` | `nickname_taken` · **422** `validation_error`.

### `POST /rooms/:code/start`
Host starts a single game. Content is resolved **server-side** (client content ignored for real games).
**Body** `{ "hostId": string, "gameId": string, "config?": object }`
**201** `{ "data": { "code", "gameId", "instanceId" } }`
**403** `not_host` · **404** `room_not_found` | `game_not_found` · **409** `game_already_running` | `not_enough_players` · **422** `validation_error` (bad config/content).

`gameId` ∈ `quizzes` · `wordshot` · `word_bomb` · `hot_take_court` · `plead_your_case` (+ engine test games `test_simultaneous`, `test_round_robin`).

**Per-game `config` (all fields optional — full defaults applied):**
- **quizzes**: `rounds`(10) `secondsPerQuestion`(20) `revealSeconds`(3) `scoringMode`(`time_weighted`|`flat`) `wrongPenaltyPct`(0) `category`(`general`|`nigerian`|…)
- **wordshot**: `rounds`(10) `secondsPerRound`(20) `revealSeconds`(3) `dupHandling`(`strict`|`relaxed`|`synonym`) `rankingDisplayCount`(5) `enabledCategories`(string[]) `letterDifficulty`(`common_only`|`includes_qxz`|`mixed`)
- **word_bomb**: `rounds`(3) `bombSecondsStart`(7) `decayPerRound`(true) `validationSeconds`(5) `dupHandling` `category`
- **hot_take_court**: `rounds`(5) `submissionSeconds`(60) `votingSeconds`(45) `revealSeconds`(5)
- **plead_your_case**: `rounds`(3) `argumentSeconds`(300) `revealSeconds`(8)

---

## League (host — room-scoped)

### `POST /rooms/:code/league`
Start a league: a queue of games played sequentially, scored percent-of-max + weighted-aggregated.
**Body** `{ "hostId": string, "aggregate?": "sum"|"average"|"top_3", "queue": [{ "gameId": string, "config?": object, "weight?": 1|2|3 }] }`
**201** `{ "data": { "code", "games": number } }`
**403** `not_host` · **404** `room_not_found` | `game_not_found` · **409** `game_already_running` | `not_enough_players` · **422** `validation_error`.

### `GET /rooms/:code/league/standings`
Cross-game aggregate standings.
**200** `{ "data": { "standings": [{ "playerId", "score" }] } }`
**404** `not_found` (no league running).

---

## Host accounts (optional — PRD §9)

### `POST /host/register`
**Body** `{ "email": string, "password": string(min 8) }` → **201** `{ "data": { "accessToken", "refreshToken" } }` · **409** `conflict` (email taken) · **422**.

### `POST /host/login`
**Body** `{ "email", "password" }` → **200** `{ "data": { "accessToken", "refreshToken" } }` · **401** `invalid_credentials`.

### `POST /host/refresh`
**Body** `{ "refreshToken": string }` → **200** `{ "data": { "accessToken", "refreshToken" } }` · **401** `token_invalid` | `session_revoked` (reuse of a rotated token revokes the chain).

---

## Admin

### `POST /admin/seed` — one-shot, env-gated (`CAN_SEED_ADMIN=true`)
Creates the first admin; **returns the generated password once**.
**Body** `{ "email": string }`
**201** `{ "data": { "email", "password" } }` — *password shown once; logs redact it.*
**403** `forbidden` (seeding disabled) · **409** `conflict` (admin already exists) · **422**.

### `POST /admin/login`
**Body** `{ "email", "password" }` → **200** `{ "data": { "accessToken", "refreshToken" } }` · **401** `invalid_credentials`.

### `POST /admin/refresh`
**Body** `{ "refreshToken" }` → **200** `{ "data": { "accessToken", "refreshToken" } }` · **401** `token_invalid` | `session_revoked`.

> All endpoints below require `Authorization: Bearer <admin accessToken>`. Missing/invalid → **401** `unauthorized`.

### Game-play history & metrics
| Method | Path | Response |
|---|---|---|
| GET | `/admin/game-plays?limit=&cursor=&gameId=` | **200** `{ data: GamePlay[], meta: { next_cursor, has_more } }` |
| GET | `/admin/game-plays/:id` | **200** `{ data: GamePlay }` · **404** `not_found` |
| GET | `/admin/sessions/:instanceId/events` | **200** `{ data: SessionEvent[] }` (size-not-contents stream) |
| GET | `/admin/metrics` | **200** `{ data: { byGame: [{ gameId, plays, avgPlayers, avgDurationMs }] } }` |

`GamePlay` = `{ id, roomCode, gameId, players[{id,nickname}], finalBoard[{playerId,points}], startedAt, endedAt, createdAt }`.

### Rubric recalibration (Plead Your Case AI)
| Method | Path | Body / Response |
|---|---|---|
| GET | `/admin/rubric` | **200** `{ data: { key, criteria: [{key,label,weight}] } }` |
| PUT | `/admin/rubric` | Body `{ criteria: [{key,label,weight}] }` → **200** `{ data: { ok: true } }` · **422** |

### Content authoring — full CRUD per kind
`:kind` ∈ `quiz_deck` · `word` · `hot_take_prompt` · `plead_scenario`.
| Method | Path | Body / Response |
|---|---|---|
| POST | `/admin/content/:kind` | Body = the content doc → **201** `{ data: doc }` · **404** (unknown kind) |
| GET | `/admin/content/:kind?limit=&cursor=` | **200** `{ data: doc[], meta }` |
| GET | `/admin/content/:kind/:id` | **200** `{ data: doc }` · **404** |
| PATCH | `/admin/content/:kind/:id` | Body = partial → **200** `{ data: doc }` · **404** |
| DELETE | `/admin/content/:kind/:id` | **204** no content · **404** |

**Content doc shapes (what admins author):**
- `quiz_deck`: `{ key, title, category, ratingTier, questions: [{ prompt, options[4], answerIdx, difficulty }] }`
- `word`: `{ word, category, startsWith, difficulty(1–3), aliases[], ratingTier, tags[] }`
- `hot_take_prompt`: `{ prompt, ratingTier, tags[] }`
- `plead_scenario`: `{ key, charge, defendant, facts, laws, precedents, ratingTier, tags[], difficulty }`

---

## WebSocket protocol (Socket.IO)

Connect to the origin; events:

**Client → server**
| Event | Payload | Notes |
|---|---|---|
| `client.join` | `{ roomCode, role: "host"\|"player"\|"display", reconnectToken?, playerId? }` | host **must** send the `hostToken` as `reconnectToken`; players send their `reconnectToken` to reclaim a seat |
| `client.action` | `{ action: <game-specific> }` | rate-limited per player; routed to the room's active game (single or league) |

**Server → client**
| Event | Payload | Notes |
|---|---|---|
| `server.joined` | `{ roomCode, role }` | join accepted |
| `server.view` | `{ audience, patch }` | projected view for this audience (answer-secrecy enforced server-side) |
| `server.error` | `{ code }` | `bad_join` · `room_not_found` · `host_auth_failed` · `seat_not_found` · `bad_action` · `rate_limited` · `no_active_game` · `invalid_action` |
| `server.room_suspended` | `{ roomCode }` | host left; 60s grace started (PRD §10) |
| `server.room_ended` | `{ roomCode }` | room closed |
| `server.resumed` | `{ roomCode }` | a reconnecting client's seat is live again |

**Game-specific `client.action` shapes:**
- quizzes: `{ type: "quizzes.answer", questionIdx, choiceIdx }`
- wordshot: `{ type: "wordshot.submit", text }`
- word_bomb: `{ type: "word_bomb.submit", text }` (current holder only)
- hot_take_court: `{ type: "hot_take.submit", text }` then `{ type: "hot_take.vote", defenceId }`
- plead_your_case: `{ type: "plead.submit", argument }`; host: `{ type: "plead.override", winnerId }`

---

## Notes

- **Content is always resolved server-side** and rating-filtered (PRD §8/§12) — clients cannot
  supply or request content outside the host's selected tiers/tags.
- **Word validation** (Wordshot/Word Bomb) is multi-level over the Mongo word DB + dictionary, with
  fuzzy near-miss suggestions. **No LLM** in validation.
- **AI** (Plead Your Case only) uses OpenAI; with a placeholder `OPENAI_API_KEY` it degrades to
  "evaluation failed" gracefully. Prompt shell = env, rubric = Mongo (admin-tunable).
- **Recovery**: rooms + in-flight games survive a server restart (Redis snapshots, ≤30s loss).
