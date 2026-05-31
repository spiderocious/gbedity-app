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

export const LobbyPlayer = z.object({ id: z.string(), nickname: z.string() });
export type LobbyPlayer = z.infer<typeof LobbyPlayer>;

export const LobbySnapshot = z.object({
  code: z.string(),
  phase: z.string(),
  players: z.array(LobbyPlayer),
});
export type LobbySnapshot = z.infer<typeof LobbySnapshot>;

export const JoinRoomResult = z.object({
  code: z.string(),
  playerId: z.string(),
  reconnectToken: z.string(),
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

export const LeagueStanding = z.object({ playerId: z.string(), score: z.number() });
export const LeagueStandings = z.object({ standings: z.array(LeagueStanding) });
export type LeagueStandings = z.infer<typeof LeagueStandings>;

// The 5 games the backend actually implements (api-docs §start). Named constants.
export const RealGameId = {
  QUIZZES: 'quizzes',
  WORDSHOT: 'wordshot',
  WORD_BOMB: 'word_bomb',
  HOT_TAKE_COURT: 'hot_take_court',
  PLEAD_YOUR_CASE: 'plead_your_case',
} as const;
export type RealGameId = (typeof RealGameId)[keyof typeof RealGameId];

export const REAL_GAME_IDS: readonly string[] = Object.values(RealGameId);
