import type { EpochMs } from '@shared/time';

import type { GameId } from '../constants';

// In-memory room state machine (game-engine.md §1, PRD §4). The room is the resting+active
// container; the GameRuntime drives the active game within it.

export const RoomPhase = {
  LOBBY: 'lobby',
  IN_GAME: 'in_game',
  SUSPENDED: 'suspended', // host left; 60s grace before the room ends (PRD §10)
  CLOSED: 'closed',
} as const;
export type RoomPhase = (typeof RoomPhase)[keyof typeof RoomPhase];

export const HOST_LEAVE_GRACE_MS = 60 * 1000; // PRD §10 — host has 60s to return

export const RoomMemberRole = {
  HOST: 'host',
  PLAYER: 'player',
  DISPLAY: 'display',
} as const;
export type RoomMemberRole = (typeof RoomMemberRole)[keyof typeof RoomMemberRole];

export interface RoomPlayer {
  id: string; // pl_<ULID>
  nickname: string;
  reconnectToken: string; // lets a refreshed player re-enter their seat (PRD §10)
  connected: boolean;
  joinedAt: EpochMs;
}

export interface ActiveGame {
  instanceId: string; // gi_<ULID>
  gameId: GameId;
}

// A single public, read-only fact about a queued game's config — the "a few, not the whole
// thing" surface players see in the lobby. It is a flat label/value pair (e.g. "Rounds" → "5"),
// never the raw config object, custom content, weights, or anything that could spoil play.
export interface LineupFact {
  label: string;
  value: string;
}

// One game in the host's published lineup, as players/display see it. Derived from the host's
// queue; the server stores it opaquely but bounds it (see LINEUP limits) so a client can't push
// arbitrary payloads into other clients' lobbies.
export interface LobbyLineupEntry {
  gameId: GameId;
  title: string;
  facts: LineupFact[];
}

export interface Room {
  code: string; // 6-char room code
  hostId: string; // pl_<ULID> of the host
  phase: RoomPhase;
  players: RoomPlayer[];
  activeGame: ActiveGame | null;
  // The host's published game lineup — visible to players + display in the lobby (read-only).
  // Empty until the host queues a game. Cleared when a game starts / the room resets.
  lobbyLineup: LobbyLineupEntry[];
  createdAt: EpochMs;
  lastActivityAt: EpochMs; // drives idle teardown (PRD §4 — 30 min)
}

// Acceptance bounds for a published lineup — the server's guard against oversized/abusive
// payloads (clients send this; the room re-serves it to everyone).
export const LINEUP_LIMITS = {
  MAX_GAMES: 20,
  MAX_FACTS_PER_GAME: 4,
  MAX_TITLE_LEN: 80,
  MAX_LABEL_LEN: 40,
  MAX_VALUE_LEN: 60,
} as const;

export const ROOM_SOFT_CAP = 50; // PRD §4 soft lobby cap
export const ROOM_IDLE_MS = 30 * 60 * 1000; // 30 minutes
