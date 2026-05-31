import { logger } from '@lib/logger';
import { now, type EpochMs } from '@shared/time';

import { SessionEventKind, type EffectKind } from './constants';

// Structured per-session event log (game-engine.md §9). HARD RULE: log shape and SIZE, never
// contents — no question text, answers, nicknames, or case material. Ids + constant tags + bytes
// only. Full reconstruction comes from deterministic replay (the plugin is pure, §6), not logs.

export interface SessionEvent {
  roomCode: string;
  instanceId: string;
  seq: number; // monotonic per instance — total order for replay
  at: EpochMs;
  kind: SessionEventKind;
  actorId?: string; // id only — never the nickname
  actionType?: string; // the Action.type constant value
  effectKind?: EffectKind;
  stateBytes?: number; // SIZE of state, not contents
  phaseFrom?: string; // phase constant values only
  phaseTo?: string;
}

// Per-instance monotonic sequence counters.
const seqByInstance = new Map<string, number>();

const nextSeq = (instanceId: string): number => {
  const next = (seqByInstance.get(instanceId) ?? 0) + 1;
  seqByInstance.set(instanceId, next);
  return next;
};

export const sessionLog = {
  emit(event: Omit<SessionEvent, 'seq' | 'at'>): SessionEvent {
    const full: SessionEvent = { ...event, seq: nextSeq(event.instanceId), at: now() };
    // To stdout for now; the admin viewer (Block 2) reads from a persisted stream later.
    logger.debug({ sessionEvent: full }, 'session.event');
    return full;
  },

  reset(instanceId: string): void {
    seqByInstance.delete(instanceId);
  },
};

// Lightweight metric hooks (§9.3). Counters/histograms ship to a backend later; for now they are
// structured log lines so the signal exists from day one.
export const metrics = {
  snapshotWritten(roomCode: string): void {
    logger.debug({ metric: 'snapshot.debounce_rate', roomCode }, 'metric');
  },
  timerDrift(key: string, driftMs: number): void {
    logger.debug({ metric: 'timer.drift_ms', key, driftMs }, 'metric');
  },
  aiLatency(ms: number): void {
    logger.debug({ metric: 'ai.request_latency_ms', ms }, 'metric');
  },
  validationLatency(ms: number): void {
    logger.debug({ metric: 'validation.request_latency_ms', ms }, 'metric');
  },
  syntheticDuringRecovery(during: boolean): void {
    logger.debug(
      { metric: 'synthetic_action.arrived_during_recovery_ratio', during },
      'metric',
    );
  },
};

// byte size of a value's JSON form — used for stateBytes without logging contents.
export const jsonBytes = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '');
  } catch {
    return 0;
  }
};
