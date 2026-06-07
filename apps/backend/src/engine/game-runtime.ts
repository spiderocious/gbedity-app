import { ulid } from 'ulid';

import { logger } from '@lib/logger';
import { now, type EpochMs } from '@shared/time';

import { ActorRole, AudienceKind, EffectKind, HostActionType, SessionEventKind, SystemActionType } from './constants';
import { jsonBytes, metrics, sessionLog } from './observability';
import { makeRandom } from './prng';
import { runAI, runValidation } from './services/service-seams';
import { persistence } from './services/persistence-hook';
import { deleteSnapshot, writeSnapshot, type GameSnapshot, type TimerSnapshot } from './snapshot';
import { noopSink, type OutputSink } from './output-sink';
import type {
  ActionCtx,
  AnyGamePlugin,
  Audience,
  Effect,
  PlayerRef,
  RatingFilter,
  RoundScore,
  ServiceResultAction,
  StepResult,
  ViewPatch,
} from './types';

// One GameRuntime drives one game instance inside one room (game-engine.md §3/§6/§7). It owns the
// clock, the effect executor, view fanout, capability gating, snapshots, and async re-entry.
// The plugin stays pure; the runtime does all the I/O.

const SNAPSHOT_DEBOUNCE_MS = 1000;

export interface RuntimeOptions {
  roomCode: string;
  plugin: AnyGamePlugin;
  players: PlayerRef[];
  seed?: string;
  // Provided only on recovery so the rehydrated runtime keeps the same identity as the snapshot.
  instanceId?: string;
  ratingFilter?: RatingFilter;
  sink?: OutputSink;
  // Called when the plugin signals ROUND_ENDED / GAME_ENDED so the Session can react (§4).
  onRoundEnded?: (score: RoundScore) => void;
  onGameEnded?: () => void;
}

interface ActiveTimer {
  fireAt: EpochMs;
  handle: ReturnType<typeof setTimeout>;
}

export class GameRuntime {
  readonly instanceId: string;
  private readonly roomCode: string;
  private readonly plugin: AnyGamePlugin;
  private readonly players: PlayerRef[];
  private readonly seed: string;
  private readonly random: () => number;
  private readonly ratingFilter: RatingFilter;
  private readonly sink: OutputSink;
  private readonly onRoundEnded: (score: RoundScore) => void;
  private readonly onGameEnded: () => void;

  private state: unknown;
  private readonly timers = new Map<string, ActiveTimer>();
  private readonly pendingRefs = new Set<string>();
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private recovering = false;
  private ended = false; // set on GAME_ENDED — stops further snapshot scheduling (SP-3)
  private eventSeq = 0; // monotonic per instance, for persisted play events

  constructor(opts: RuntimeOptions) {
    this.instanceId = opts.instanceId ?? `gi_${ulid()}`;
    this.roomCode = opts.roomCode;
    this.plugin = opts.plugin;
    this.players = opts.players;
    this.seed = opts.seed ?? ulid();
    this.random = makeRandom(this.seed);
    this.ratingFilter = opts.ratingFilter ?? { tiers: [] };
    this.sink = opts.sink ?? noopSink;
    this.onRoundEnded = opts.onRoundEnded ?? ((): void => undefined);
    this.onGameEnded = opts.onGameEnded ?? ((): void => undefined);
    this.state = undefined;
  }

  // Start a fresh instance: validate config/content, init the plugin, run resulting effects.
  start(config: unknown, content: unknown): void {
    const parsedConfig = this.plugin.configSchema.parse(config);
    const parsedContent = this.plugin.contentSchema.parse(content);
    const step = this.plugin.init({
      config: parsedConfig,
      content: parsedContent,
      players: this.players,
      seed: this.seed,
      startedAt: now(),
      random: this.random,
    });
    // init's state + initial effects (e.g. arm the first timer, broadcast) flow through the
    // same executor as every other step.
    this.applyStep(step);
  }

  // Dispatch a client action. The caller (gateway) authenticated the actor and passes its verified
  // role (host is token-verified at join), so plugins can gate host-only actions. The runtime
  // validates the action shape + capability gating here.
  dispatchAction(actor: PlayerRef, role: ActorRole, rawAction: unknown): void {
    // Engine-level host controls (host.end_game / host.skip) are handled BEFORE the plugin's
    // actionSchema — they aren't game actions, so they'd fail per-game validation. Only the
    // token-verified host role is honored; anyone else's host-control attempt is a silent no-op.
    const hostAction = this.hostActionType(rawAction);
    if (hostAction !== undefined) {
      if (role === ActorRole.HOST) {
        sessionLog.emit({
          roomCode: this.roomCode,
          instanceId: this.instanceId,
          kind: SessionEventKind.ACTION_IN,
          actorId: actor.id,
          actionType: hostAction,
        });
        if (hostAction === HostActionType.END_GAME) this.endGame();
        else this.runTick(); // host.skip → advance the current phase early via onTick
      }
      return;
    }

    const action = this.plugin.actionSchema.parse(rawAction);
    const actionType = this.actionType(action);
    sessionLog.emit({
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      kind: SessionEventKind.ACTION_IN,
      actorId: actor.id,
      ...(actionType !== undefined && { actionType }),
    });
    const ctx: ActionCtx = { actor, role, now: now(), random: this.random };
    this.applyStep(this.plugin.onAction(this.requireState(), action, ctx));
  }

  // Fire a timer's onTick. Called by the runtime's own clock — guards on map membership so a
  // cleared/already-fired timer is a no-op.
  private fireTimer(key: string): void {
    const timer = this.timers.get(key);
    if (!timer) return;
    metrics.timerDrift(key, now() - timer.fireAt);
    this.timers.delete(key);
    this.runTick();
  }

  // Apply a single onTick. Shared by fireTimer (live clock) and rehydrate (missed deadlines on
  // recovery) — recovery calls this directly, so it does NOT depend on the timer being in the map.
  private runTick(): void {
    this.applyStep(this.plugin.onTick(this.requireState(), now(), { random: this.random }));
  }

  // ── Effect execution (§3) ───────────────────────────────────────────────────

  private applyStep(step: StepResult<unknown>): void {
    // Pre-flight: reject the whole step if any effect is capability-illegal, BEFORE committing
    // state — otherwise a throw mid-effect-loop leaves the runtime in a half-applied state with
    // earlier effects already fired and no rollback (P2). A mis-declared plugin fails cleanly.
    this.assertEffectsAllowed(step.effects);

    this.state = step.state;
    sessionLog.emit({
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      kind: SessionEventKind.STATE_TRANSITION,
      stateBytes: jsonBytes(this.state),
    });
    for (const effect of step.effects) this.execute(effect);
    this.scheduleSnapshot();
  }

  // Verify every effect is permitted by the plugin's declared capabilities. Throws before any
  // state mutation if not — capability gating moved here so it's all-or-nothing.
  private assertEffectsAllowed(effects: Effect[]): void {
    const caps = this.plugin.manifest.capabilities;
    for (const effect of effects) {
      if (effect.kind === EffectKind.REQUEST_VALIDATION && caps.needsValidation !== true) {
        throw new Error(`plugin ${this.plugin.manifest.id} emitted REQUEST_VALIDATION without the capability`);
      }
      if (effect.kind === EffectKind.REQUEST_AI && caps.needsAI !== true) {
        throw new Error(`plugin ${this.plugin.manifest.id} emitted REQUEST_AI without the capability`);
      }
    }
  }

  private execute(effect: Effect): void {
    sessionLog.emit({
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      kind: SessionEventKind.EFFECT_OUT,
      effectKind: effect.kind,
    });

    switch (effect.kind) {
      case EffectKind.BROADCAST:
        this.broadcast();
        return;
      case EffectKind.TO_PLAYER:
        this.sendToPlayer(effect.playerId);
        return;
      case EffectKind.TO_DISPLAY:
        this.sink.send(this.roomCode, { kind: AudienceKind.DISPLAY }, this.viewFor({ kind: AudienceKind.DISPLAY }));
        return;
      case EffectKind.START_TIMER:
        this.startTimer(effect.key, effect.fireAt);
        return;
      case EffectKind.CLEAR_TIMER:
        this.clearTimer(effect.key);
        return;
      case EffectKind.REQUEST_VALIDATION:
        // capability already verified in assertEffectsAllowed() before state was committed
        this.dispatchService(effect.ref, runValidation(effect.payload));
        return;
      case EffectKind.REQUEST_AI:
        this.dispatchService(effect.ref, runAI(effect.payload));
        return;
      case EffectKind.PERSIST_EVENT:
        // Persistence hook — game-play history (PRD §9). The installed hook writes to Mongo; if
        // none installed it's a no-op. Plugin describes WHAT (event type + data), not HOW.
        persistence().recordEvent({
          instanceId: this.instanceId,
          roomCode: this.roomCode,
          seq: this.eventSeq++,
          at: now(),
          type: effect.event.type,
          data: effect.event.data,
        });
        return;
      case EffectKind.ROUND_ENDED:
        this.onRoundEnded(this.plugin.scoreRound(this.requireState()));
        return;
      case EffectKind.GAME_ENDED:
        // Mark ended BEFORE the callback — the session's onEnded may dispose this runtime
        // (deleting the snapshot), and applyStep would otherwise re-schedule one right after,
        // resurrecting the snapshot of a finished game (SP-3). `ended` blocks that re-schedule.
        this.ended = true;
        this.onGameEnded();
        return;
      default: {
        // exhaustiveness — every EffectKind handled above
        const _never: never = effect;
        return _never;
      }
    }
  }

  // ── Async service re-entry (§5) ──────────────────────────────────────────────

  private dispatchService(ref: string, work: Promise<{ ok: boolean; data: unknown }>): void {
    this.pendingRefs.add(ref);
    void work
      .then((result) => {
        metrics.syntheticDuringRecovery(this.recovering);
        this.pendingRefs.delete(ref);
        const synthetic: ServiceResultAction = {
          type: SystemActionType.SERVICE_RESULT,
          ref,
          result,
        };
        // Re-enter the plugin synchronously — it handles the verdict like any action. System role
        // is HOST (trusted) so a verdict is never blocked by host-only gating.
        const ctx: ActionCtx = { actor: this.systemActor(), role: ActorRole.HOST, now: now(), random: this.random };
        this.applyStep(this.plugin.onAction(this.requireState(), synthetic, ctx));
      })
      .catch((err: unknown) => {
        this.pendingRefs.delete(ref);
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ roomCode: this.roomCode, ref, err: message }, 'service dispatch failed');
      });
  }

  // ── Timers (§6) ───────────────────────────────────────────────────────────────

  private startTimer(key: string, fireAt: EpochMs): void {
    this.clearTimer(key);
    const delay = Math.max(0, fireAt - now());
    const handle = setTimeout(() => this.fireTimer(key), delay);
    this.timers.set(key, { fireAt, handle });
  }

  private clearTimer(key: string): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing.handle);
      this.timers.delete(key);
    }
  }

  // ── View fanout (§2.3) ────────────────────────────────────────────────────────

  private broadcast(): void {
    this.sink.send(this.roomCode, { kind: AudienceKind.HOST }, this.viewFor({ kind: AudienceKind.HOST }));
    this.sink.send(this.roomCode, { kind: AudienceKind.DISPLAY }, this.viewFor({ kind: AudienceKind.DISPLAY }));
    for (const p of this.players) {
      const audience: Audience = { kind: AudienceKind.PLAYER, playerId: p.id, spectator: false };
      this.sink.send(this.roomCode, audience, this.viewFor(audience));
    }
  }

  private sendToPlayer(playerId: string): void {
    const audience: Audience = { kind: AudienceKind.PLAYER, playerId, spectator: false };
    this.sink.send(this.roomCode, audience, this.viewFor(audience));
  }

  private viewFor(audience: Audience): ViewPatch {
    return this.plugin.view(this.requireState(), audience, { ratingFilter: this.ratingFilter });
  }

  // ── Snapshot / recovery (§6) ──────────────────────────────────────────────────

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      void this.snapshot();
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  private async snapshot(): Promise<void> {
    const timers: TimerSnapshot[] = [...this.timers].map(([key, t]) => ({ key, fireAt: t.fireAt }));
    const snap: GameSnapshot = {
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      gameId: this.plugin.manifest.id,
      seed: this.seed,
      players: this.players,
      state: this.state,
      timers,
      pendingRefs: [...this.pendingRefs],
      snapshotAt: now(),
    };
    await writeSnapshot(snap);
    metrics.snapshotWritten(this.roomCode);
    sessionLog.emit({
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      kind: SessionEventKind.SNAPSHOT,
      stateBytes: jsonBytes(this.state),
    });
  }

  // Rehydrate from a snapshot on restart: restore state, re-arm future timers, fire missed ones.
  rehydrate(snapshot: GameSnapshot): void {
    this.recovering = true;
    this.state = snapshot.state;
    for (const ref of snapshot.pendingRefs) this.pendingRefs.add(ref);
    sessionLog.emit({
      roomCode: this.roomCode,
      instanceId: this.instanceId,
      kind: SessionEventKind.RECOVERY,
      stateBytes: jsonBytes(this.state),
    });
    const current = now();
    for (const t of snapshot.timers) {
      if (t.fireAt <= current) {
        // Deadline elapsed while we were down — fire the missed tick directly (the timer was
        // never re-inserted into the map, so fireTimer() would no-op; runTick() doesn't guard).
        metrics.timerDrift(t.key, current - t.fireAt);
        this.runTick();
      } else {
        this.startTimer(t.key, t.fireAt);
      }
    }
    this.broadcast();
    this.recovering = false;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  // Host-initiated end (host.end_game). Stop the clock and signal the session to wind down — the
  // same terminal path a natural GAME_ENDED takes (session.onEnded → room back to lobby). Broadcasts
  // a final view first so every client sees the game close, not a frozen mid-round screen.
  private endGame(): void {
    for (const [, t] of this.timers) clearTimeout(t.handle);
    this.timers.clear();
    this.broadcast();
    this.onGameEnded();
  }

  isOver(): boolean {
    return this.plugin.isOver(this.requireState());
  }

  async dispose(): Promise<void> {
    for (const [, t] of this.timers) clearTimeout(t.handle);
    this.timers.clear();
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    await deleteSnapshot(this.roomCode);
    sessionLog.reset(this.instanceId);
  }

  // Expose current state read-only (sessions/tests inspect; never mutate through this).
  snapshotState(): unknown {
    return this.state;
  }

  // Re-project current state to a single (reconnecting) player — drives the resume indicator.
  resendTo(playerId: string): void {
    if (this.state === undefined) return;
    this.sendToPlayer(playerId);
  }

  // Identity + roster for a game-play record (the session supplies the final board + timing).
  playIdentity(): { id: string; roomCode: string; gameId: string; players: PlayerRef[] } {
    return { id: this.instanceId, roomCode: this.roomCode, gameId: this.plugin.manifest.id, players: this.players };
  }

  private requireState(): unknown {
    if (this.state === undefined) throw new Error('runtime not started');
    return this.state;
  }

  private systemActor(): PlayerRef {
    return { id: 'system', nickname: 'system' };
  }

  private actionType(action: unknown): string | undefined {
    if (typeof action === 'object' && action !== null && 'type' in action) {
      const t = (action as { type: unknown }).type;
      return typeof t === 'string' ? t : undefined;
    }
    return undefined;
  }

  // Narrow an opaque action to an engine-level host-control type, else undefined (a game action).
  private hostActionType(action: unknown): HostActionType | undefined {
    const t = this.actionType(action);
    return t === HostActionType.END_GAME || t === HostActionType.SKIP ? t : undefined;
  }
}
