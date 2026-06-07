import type { z } from 'zod';

import type { EpochMs } from '@shared/time';
import type { MessageKey } from '@shared/messages/keys';

import type {
  ActorRole,
  AudienceKind,
  EffectKind,
  GameCategory,
  GameId,
  GameMode,
  SystemActionType,
} from './constants';

// The plugin/runtime contract. See docs/backend/game-engine.md. A plugin is a pure,
// JSON-serializable state-transition function: no clocks, no I/O, no DB, no env.

// ── Identity & roster ───────────────────────────────────────────────────────

export interface PlayerRef {
  id: string; // pl_<ULID>
  nickname: string;
}

// ── Manifest (§2.1) ─────────────────────────────────────────────────────────

export interface GameManifest {
  id: GameId;
  title: string;
  category: GameCategory;
  mode: GameMode;
  players: {
    min: number; // HARD floor — always enforced
    max: number | null; // HARD ceiling — null = unbounded
    recommendedMax: number; // UX guidance — never enforced
  };
  capabilities: {
    needsValidation?: boolean;
    needsAI?: boolean;
    needsTTS?: boolean;
  };
  // Single-player support (see docs/backend/single-player-spec.md). Absent ⇒ NOT solo-playable.
  // A game is solo-able only when its scoring depends on the player + clock + content, never on
  // other humans (so the peer-vote/peer-rate games declare nothing here and are refused solo).
  solo?: {
    supported: boolean;
    minPlayers?: number; // overrides players.min in solo (unused now; reserved)
    disabledConfig?: string[]; // config keys forced off in solo (unused now; reserved)
  };
}

// ── Audience & views (§2.3) ───────────────────────────────────────────────────

export type Audience =
  | { kind: typeof AudienceKind.HOST }
  | { kind: typeof AudienceKind.DISPLAY }
  | { kind: typeof AudienceKind.PLAYER; playerId: string; spectator: boolean };

// A view projection is opaque JSON the runtime ships to a client. Plugins decide its shape.
export type ViewPatch = Record<string, unknown>;

export interface RatingFilter {
  tiers: string[]; // e.g. Family / Friends — resolved server-side before init
}

// ── Contexts (§2.3) — read-only, never `req` ──────────────────────────────────

export interface ActionCtx {
  actor: PlayerRef;
  role: ActorRole; // host | player — for gating host-only actions. Trustworthy (host is token-verified at join).
  now: EpochMs;
  random: () => number; // seeded PRNG provided by the runtime (§6)
}

export interface TickCtx {
  random: () => number;
}

export interface ViewCtx {
  ratingFilter: RatingFilter;
}

// ── init input (§2.2) ─────────────────────────────────────────────────────────

export interface InitInput<Config, Content> {
  config: Config;
  content: Content;
  players: PlayerRef[];
  seed: string;
  startedAt: EpochMs;
  random: () => number;
}

// ── Effects (§3) ──────────────────────────────────────────────────────────────

export interface ValidationRequest {
  // abstract on purpose — concrete payload defined when the validation service is built (§10)
  [key: string]: unknown;
}
export interface AIRequest {
  [key: string]: unknown;
}

export interface GamePlayEvent {
  type: string; // a per-game event-type constant value
  data: Record<string, unknown>;
}

export type Effect =
  | { kind: typeof EffectKind.BROADCAST }
  | { kind: typeof EffectKind.TO_PLAYER; playerId: string }
  | { kind: typeof EffectKind.TO_DISPLAY }
  | { kind: typeof EffectKind.START_TIMER; key: string; fireAt: EpochMs }
  | { kind: typeof EffectKind.CLEAR_TIMER; key: string }
  | { kind: typeof EffectKind.REQUEST_VALIDATION; ref: string; payload: ValidationRequest }
  | { kind: typeof EffectKind.REQUEST_AI; ref: string; payload: AIRequest }
  | { kind: typeof EffectKind.PERSIST_EVENT; event: GamePlayEvent }
  | { kind: typeof EffectKind.ROUND_ENDED }
  | { kind: typeof EffectKind.GAME_ENDED };

export interface StepResult<State> {
  state: State;
  effects: Effect[];
}

// ── Scoring (§4) ────────────────────────────────────────────────────────────

export interface ScoreDelta {
  playerId: string;
  points: number; // this game's own scale
  reason: MessageKey;
}

export interface RoundScore {
  deltas: ScoreDelta[];
  maxPoints: number; // the max a single player could have earned this round
}

// ── The plugin (§2) ───────────────────────────────────────────────────────────

// A synthetic service-result action the runtime injects (§5). Plugins handle it like any action.
export interface ServiceResultAction {
  type: typeof SystemActionType.SERVICE_RESULT;
  ref: string;
  result: unknown;
}

export interface GamePlugin<Config, State, Action, Content> {
  readonly manifest: GameManifest;

  // Output type is pinned to the plugin's type; input is `unknown` so schemas with .default()
  // (whose input differs from output) satisfy the contract.
  readonly configSchema: z.ZodType<Config, z.ZodTypeDef, unknown>;
  readonly contentSchema: z.ZodType<Content, z.ZodTypeDef, unknown>;
  readonly actionSchema: z.ZodType<Action, z.ZodTypeDef, unknown>;

  // init returns state AND initial effects (e.g. arm the first timer + broadcast). The doc's §2
  // signature showed `: State`; the §8 example emitted effects from init — this StepResult form
  // reconciles them so initial timers/fanout flow through the same executor as every other step.
  init(input: InitInput<Config, Content>): StepResult<State>;
  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State>;
  onTick(state: State, now: EpochMs, ctx: TickCtx): StepResult<State>;

  view(state: State, audience: Audience, ctx: ViewCtx): ViewPatch;
  scoreRound(state: State): RoundScore;
  isOver(state: State): boolean;
}

// A plugin with its generics erased — what registries and the runtime hold. The runtime treats
// Config/State/Action/Content opaquely (it only forwards them), so `unknown` is the honest type;
// each concrete plugin keeps its precise generics internally.
export type AnyGamePlugin = GamePlugin<unknown, unknown, unknown, unknown>;
