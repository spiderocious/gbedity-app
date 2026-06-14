import { z } from 'zod';

// REST response models, Zod-parsed at the boundary (hard-lessons: validate external data).
// Shapes confirmed against the live backend (see docs/frontend/integration-plan.md §2/§8).

export const CreateRoomResult = z.object({
  code: z.string(),
  hostId: z.string(),
  hostToken: z.string(),
  display_url: z.string(),
  join_url: z.string(),
});
export type CreateRoomResult = z.infer<typeof CreateRoomResult>;

// `spectator` defaults false so older servers (no flag) parse cleanly.
export const LobbyPlayer = z.object({ id: z.string(), nickname: z.string(), spectator: z.boolean().default(false) });
export type LobbyPlayer = z.infer<typeof LobbyPlayer>;

// The host's published lineup, mirrored from PUT /rooms/:code/lineup — what players + display
// see in the lobby. Matches the backend LobbyLineupEntry / LineupFact shape exactly (the seam).
export const LineupFact = z.object({ label: z.string(), value: z.string() });
export type LineupFact = z.infer<typeof LineupFact>;

export const LineupEntry = z.object({
  gameId: z.string(),
  title: z.string(),
  facts: z.array(LineupFact),
});
export type LineupEntry = z.infer<typeof LineupEntry>;

// The game currently running in the room (null in the lobby). Lets the host join or end an
// in-flight game instead of hitting a dead game_already_running error. Matches backend ActiveGame.
export const ActiveGame = z.object({ instanceId: z.string(), gameId: z.string() });
export type ActiveGame = z.infer<typeof ActiveGame>;

export const LobbySnapshot = z.object({
  code: z.string(),
  phase: z.string(),
  players: z.array(LobbyPlayer),
  // Older servers may omit it; default to [] so the client never crashes on an absent lineup.
  lineup: z.array(LineupEntry).default([]),
  // Older servers may omit it; default null (no running game).
  activeGame: ActiveGame.nullable().default(null),
});
export type LobbySnapshot = z.infer<typeof LobbySnapshot>;

export const JoinRoomResult = z.object({
  code: z.string(),
  playerId: z.string(),
  reconnectToken: z.string(),
  spectator: z.boolean().default(false),
});
export type JoinRoomResult = z.infer<typeof JoinRoomResult>;

export const StartGameResult = z.object({
  code: z.string(),
  gameId: z.string(),
  instanceId: z.string(),
});
export type StartGameResult = z.infer<typeof StartGameResult>;

export const StartLeagueResult = z.object({ code: z.string(), games: z.number() });
export type StartLeagueResult = z.infer<typeof StartLeagueResult>;

// POST /solo/start — single-device session. The backend collapses host+player+display onto one
// socket; `wsRole` is the role to join with (always 'player'). `soloId` IS the room code, so the
// existing in-game player surface (/p/:code/game) renders solo with no changes.
export const StartSoloResult = z.object({
  soloId: z.string(),
  gameId: z.string(),
  instanceId: z.string(),
  playerId: z.string(),
  reconnectToken: z.string(),
  wsRole: z.string(),
});
export type StartSoloResult = z.infer<typeof StartSoloResult>;

export const LeagueStanding = z.object({ playerId: z.string(), score: z.number() });
export const LeagueStandings = z.object({ standings: z.array(LeagueStanding) });
export type LeagueStandings = z.infer<typeof LeagueStandings>;

// NOTE: the old hardcoded `RealGameId` / `REAL_GAME_IDS` (a frontend guess at which games the
// backend implements) was deleted. The catalogue endpoint is the per-environment source of truth:
// every game the catalogue store returns is real and startable via its own `gameId`. Renderer
// routing uses `LiveGameId` (features/in-game/resolve-live-game.ts) — backend ids that have a live
// renderer, not a visibility list.
