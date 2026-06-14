import type { ViewPatch } from '../../../../../shared/types/view.ts';

// The Wordshot multiplayer view-model — a typed, game-specific read of the permissive ViewPatch
// the engine broadcasts. Mirrors the plugin's view() (apps/backend/src/games/wordshot/wordshot.plugin.ts).

// Backend phase strings for Wordshot (named POJO; no inline unions).
export const WsBackendPhase = {
  ROUND: 'round',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
export type WsBackendPhase = (typeof WsBackendPhase)[keyof typeof WsBackendPhase];

export interface WsRankedEntry {
  readonly text: string;
  readonly score: number;
}

export interface WsBoardRow {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

export interface WsSubmission {
  readonly text: string;
  readonly valid: boolean | null;
  readonly score: number | null;
}

export interface WsView {
  readonly phase: WsBackendPhase | string;
  readonly roundIndex: number;
  readonly rounds: number;
  readonly letter: string;
  readonly category: string;
  readonly ranked: readonly WsRankedEntry[];  // live top-N valid submissions (all audiences)
  readonly deadline: number | null;           // absolute epoch-ms; client computes countdown from this
  readonly secondsPerRound: number;
  readonly revealSeconds: number;
  readonly board: readonly WsBoardRow[];
  // player-only (guarded with defaults for spectator/host base patch):
  readonly yourScore: number;
  readonly yourSubmission: WsSubmission | null; // non-null = this seat has submitted
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const parseRanked = (raw: unknown): WsRankedEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({ text: str(r.text), score: num(r.score, 0) }));
};

const parseBoard = (raw: unknown): WsBoardRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      playerId: str(r.playerId),
      points: num(r.points, 0),
      roundDelta: num(r.roundDelta, 0),
    }));
};

const parseSubmission = (raw: unknown): WsSubmission | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    text: str(r.text),
    valid: typeof r.valid === 'boolean' ? r.valid : null,
    score: typeof r.score === 'number' ? r.score : null,
  };
};

// Narrow a live ViewPatch (player or display audience) into the typed WsView. Player-only fields
// default safely for the spectator/host base patch (which doesn't carry them).
export function toWsView(patch: ViewPatch): WsView {
  return {
    phase: str(patch.phase),
    roundIndex: num(patch.roundIndex, 0),
    rounds: num(patch.rounds, 0),
    letter: str(patch.letter),
    category: str(patch.category),
    ranked: parseRanked(patch.ranked),
    deadline: typeof patch.deadline === 'number' ? patch.deadline : null,
    secondsPerRound: num(patch.secondsPerRound, 0),
    revealSeconds: num(patch.revealSeconds, 0),
    board: parseBoard(patch.board),
    yourScore: num(patch.yourScore, 0),
    yourSubmission: parseSubmission(patch.yourSubmission),
  };
}
