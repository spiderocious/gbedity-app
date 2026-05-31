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

export interface Room {
  code: string; // 6-char room code
  hostId: string; // pl_<ULID> of the host
  phase: RoomPhase;
  players: RoomPlayer[];
  activeGame: ActiveGame | null;
  createdAt: EpochMs;
  lastActivityAt: EpochMs; // drives idle teardown (PRD §4 — 30 min)
}

export const ROOM_SOFT_CAP = 50; // PRD §4 soft lobby cap
export const ROOM_IDLE_MS = 30 * 60 * 1000; // 30 minutes
