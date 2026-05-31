import type { EpochMs } from '@shared/time';

// Injected persistence hook (game-engine.md §9, PRD §9). The engine emits play events + game-end
// records but must not import @features — the app bootstrap installs the real Mongo-backed impl.
// Until installed, hooks are no-ops so the engine runs without persistence.

export interface PlayEvent {
  instanceId: string;
  roomCode: string;
  seq: number;
  at: EpochMs;
  type: string;
  data: Record<string, unknown>;
}

export interface PlaySummary {
  id: string; // instanceId
  roomCode: string;
  gameId: string;
  players: { id: string; nickname: string }[];
  finalBoard: { playerId: string; points: number }[];
  startedAt: EpochMs;
  endedAt: EpochMs;
}

export interface PersistenceHook {
  recordEvent(event: PlayEvent): void; // fire-and-forget
  recordPlay(summary: PlaySummary): void; // fire-and-forget
}

const noop: PersistenceHook = { recordEvent: () => undefined, recordPlay: () => undefined };

let hook: PersistenceHook = noop;

export const setPersistenceHook = (h: PersistenceHook): void => {
  hook = h;
};

export const persistence = (): PersistenceHook => hook;
