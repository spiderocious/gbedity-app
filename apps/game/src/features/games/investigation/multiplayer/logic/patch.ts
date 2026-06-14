import type { ViewPatch } from '../../../../../shared/types/view.ts';

// The Investigation multiplayer view-model — a typed read of the permissive ViewPatch the engine
// broadcasts. Mirrors the plugin's view() (apps/backend/.../investigation.plugin.ts). The full case
// file is served pre-reveal (answer withheld); the solution/explanation arrive at reveal.

export const InvBackendPhase = { INVESTIGATE: 'investigate', REVEAL: 'reveal', DONE: 'done' } as const;
export type InvBackendPhase = (typeof InvBackendPhase)[keyof typeof InvBackendPhase];

export interface InvBoardRow {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

export interface InvView {
  readonly phase: InvBackendPhase | string;
  readonly title: string;
  readonly category: string;
  readonly brief: string;
  readonly suspects: readonly unknown[];
  readonly reports: readonly unknown[];
  readonly witnesses: readonly unknown[];
  readonly transcripts: readonly unknown[];
  readonly timeline: readonly unknown[];
  readonly tools: readonly unknown[];
  readonly deadline: number | null;
  readonly investigateSeconds: number;
  // reveal-only
  readonly solutionSuspectId: string | null;
  readonly keyEvidenceId: string | null;
  readonly explanation: string;
  readonly board: readonly InvBoardRow[];
  // player-only
  readonly yourAccusation: string | null;
  readonly yourEvidence: string | null;
  readonly yourConfidence: string | null;
  readonly locked: boolean;
  readonly yourScore: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const parseBoard = (raw: unknown): InvBoardRow[] =>
  Array.isArray(raw)
    ? raw
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => ({ playerId: str(r.playerId), points: num(r.points, 0), roundDelta: num(r.roundDelta, 0) }))
    : [];

export function toInvView(patch: ViewPatch): InvView {
  return {
    phase: str(patch.phase),
    title: str(patch.title) || 'Investigation',
    category: str(patch.category) || 'Investigation',
    brief: str(patch.brief),
    suspects: arr(patch.suspects),
    reports: arr(patch.reports),
    witnesses: arr(patch.witnesses),
    transcripts: arr(patch.transcripts),
    timeline: arr(patch.timeline),
    tools: arr(patch.tools),
    deadline: typeof patch.deadline === 'number' ? patch.deadline : null,
    investigateSeconds: num(patch.phaseSeconds, 300),
    solutionSuspectId: typeof patch.solutionSuspectId === 'string' ? patch.solutionSuspectId : null,
    keyEvidenceId: typeof patch.keyEvidenceId === 'string' ? patch.keyEvidenceId : null,
    explanation: str(patch.explanation),
    board: parseBoard(patch.board),
    yourAccusation: typeof patch.yourAccusation === 'string' ? patch.yourAccusation : null,
    yourEvidence: typeof patch.yourEvidence === 'string' ? patch.yourEvidence : null,
    yourConfidence: typeof patch.yourConfidence === 'string' ? patch.yourConfidence : null,
    locked: patch.locked === true,
    yourScore: num(patch.yourScore, 0),
  };
}
