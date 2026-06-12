import type { ViewPatch } from '../../../shared/types/view.ts';
import { LiveGameId } from '../resolve-live-game.ts';

// The flow registry — maps a backend gameId → its animated flow component, so the in-game screens
// don't hardcode `=== MISSING_LETTERS`. Each game's flow module registers here. A game with no
// bespoke flow yet falls back to the generic live-renderer path in the screens.

export type FlowAudience = 'player' | 'host' | 'spectator';

export interface GameFlowProps {
  readonly patch: ViewPatch | null;
  readonly send: (action: Record<string, unknown>) => void;
  readonly audience: FlowAudience;
  readonly code?: string;
}

export type GameFlowComponent = (props: GameFlowProps) => React.ReactNode;

const REGISTRY: Record<string, GameFlowComponent> = {};

// Register a game's flow component by its backend gameId. Called once per game module (side-effect
// import below). Idempotent.
export function registerGameFlow(gameId: string, component: GameFlowComponent): void {
  REGISTRY[gameId] = component;
}

export function getGameFlow(gameId: string | undefined): GameFlowComponent | undefined {
  return gameId === undefined ? undefined : REGISTRY[gameId];
}

// Side-effect imports: each module calls registerGameFlow at import time. Adding a game = add its
// flow module + one import line here. (LiveGameId re-exported for screens that branch on it.)
export { LiveGameId };
