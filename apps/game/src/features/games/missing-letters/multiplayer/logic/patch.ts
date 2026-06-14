import type { ViewPatch } from '../../../../../shared/types/view.ts';

// The Missing Letters multiplayer view-model — a typed, game-specific read of the permissive
// ViewPatch the engine broadcasts (shared/types/view.ts). The driver narrows the live patch into
// this so the screens never poke at loose optional fields. Mirrors the plugin's player/spectator
// view() (apps/backend/src/games/missing-letters/missing-letters.plugin.ts:186-216).

// Backend phase strings for this game (named POJO; no inline unions).
export const MlBackendPhase = {
  COUNTDOWN: 'countdown',
  ROUND: 'round',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
export type MlBackendPhase = (typeof MlBackendPhase)[keyof typeof MlBackendPhase];

export interface MlBoardRow {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

export interface MlView {
  readonly phase: MlBackendPhase | string;
  readonly idx: number;
  readonly rounds: number;
  readonly masked: string;
  readonly length: number;
  readonly deadline: number | null; // absolute epoch-ms; client computes countdowns from this
  readonly secondsPerRound: number;
  readonly revealSeconds: number;
  readonly answer: string | null; // present only at reveal
  readonly board: readonly MlBoardRow[];
  readonly locked: boolean; // player-only; this seat has submitted this round
  readonly solved: boolean; // player-only; this seat's submission was correct
  readonly yourScore: number; // player-only; cumulative
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const parseBoard = (raw: unknown): MlBoardRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      playerId: str(r.playerId),
      points: num(r.points, 0),
      roundDelta: num(r.roundDelta, 0),
    }));
};

// Narrow a live ViewPatch (player or spectator audience) into the typed MlView. Player-only fields
// default safely for the spectator/host base patch (which doesn't carry them).
export function toMlView(patch: ViewPatch): MlView {
  return {
    phase: str(patch.phase),
    idx: num(patch.idx, 0),
    rounds: num(patch.rounds, 0),
    masked: str(patch.masked),
    length: num(patch.length, 0),
    deadline: typeof patch.deadline === 'number' ? patch.deadline : null,
    secondsPerRound: num(patch.secondsPerRound, 0),
    revealSeconds: num(patch.revealSeconds, 0),
    answer: typeof patch.answer === 'string' ? patch.answer : null,
    board: parseBoard(patch.board),
    locked: patch.locked === true,
    solved: patch.solved === true,
    yourScore: num(patch.yourScore, 0),
  };
}
