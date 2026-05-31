// Time helpers. UTC everywhere. EpochMs is the canonical internal representation (the engine's
// timers and deadlines are absolute epoch-ms — see game-engine.md §6); ISO strings cross the wire.

export type EpochMs = number;

export const now = (): EpochMs => Date.now();

export const nowIso = (): string => new Date().toISOString();

export const toIso = (ms: EpochMs): string => new Date(ms).toISOString();
