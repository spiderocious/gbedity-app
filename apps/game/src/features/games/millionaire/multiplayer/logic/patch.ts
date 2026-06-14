import type { ViewPatch } from '../../../../../shared/types/view.ts';

// The Millionaire multiplayer view-model — typed read of the permissive ViewPatch the engine
// broadcasts. Mirrors the plugin's view() (apps/backend/src/games/millionaire/millionaire.plugin.ts).
// All player-private fields default safely for the spectator/display patch (which doesn't carry them).

export const MmPhase = {
  TURN_INTRO: 'turn_intro',
  QUESTION: 'question',
  AUDIENCE_POLL: 'audience_poll',
  PHONE_WAIT: 'phone_wait',
  REVEAL: 'reveal',
  DONE: 'done',
} as const;
export type MmPhase = (typeof MmPhase)[keyof typeof MmPhase];

export interface MmBoardRow {
  readonly playerId: string;
  readonly points: number;
  readonly roundDelta: number;
}

export interface MmView {
  readonly phase: MmPhase | string;
  readonly qIndex: number;
  readonly rung: number;
  readonly ladder: number[];
  readonly holderId: string | null;
  readonly prompt: string;
  readonly options: string[];
  readonly hiddenOptions: number[];
  readonly eliminated: string[];
  readonly banked: Record<string, number>;
  readonly deadline: number | null;
  readonly secondsPerRound: number;
  readonly revealSeconds: number;
  readonly answerIdx: number | null;      // REVEAL only
  readonly lastCorrect: boolean | null;   // REVEAL only — the holder's outcome
  readonly audienceTally: number[];       // [0,0,0,0]; AUDIENCE_POLL + REVEAL only
  readonly board: MmBoardRow[];
  readonly questionCount: number;
  readonly order: string[];
  // player-private (default-safe for spectator)
  readonly yourTurn: boolean;
  readonly canVoteAudience: boolean;
  readonly youArePhoned: boolean;
  readonly lifelinesUsed: string[];
  readonly phoneSuggestion: number | null;
  readonly yourScore: number;
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const parseBoard = (raw: unknown): MmBoardRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      playerId: str(r.playerId),
      points: num(r.points, 0),
      roundDelta: num(r.roundDelta, 0),
    }));
};

const parseNumArr = (raw: unknown): number[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === 'number');
};

const parseStrArr = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
};

const parseBanked = (raw: unknown): Record<string, number> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number') out[k] = v;
  }
  return out;
};

export function toMmView(patch: ViewPatch): MmView {
  return {
    phase: str(patch.phase),
    qIndex: num(patch.qIndex, 0),
    rung: num(patch.rung, 0),
    ladder: parseNumArr(patch.ladder),
    holderId: typeof patch.holderId === 'string' ? patch.holderId : null,
    prompt: str(patch.prompt),
    options: parseStrArr(patch.options),
    hiddenOptions: parseNumArr(patch.hiddenOptions),
    eliminated: parseStrArr(patch.eliminated),
    banked: parseBanked(patch.banked),
    deadline: typeof patch.deadline === 'number' ? patch.deadline : null,
    secondsPerRound: num(patch.secondsPerRound, 30),
    revealSeconds: num(patch.revealSeconds, 4),
    answerIdx: typeof patch.answerIdx === 'number' ? patch.answerIdx : null,
    lastCorrect: typeof patch.lastCorrect === 'boolean' ? patch.lastCorrect : null,
    audienceTally: parseNumArr(patch.audienceTally).length === 4 ? parseNumArr(patch.audienceTally) : [0, 0, 0, 0],
    board: parseBoard(patch.board),
    questionCount: num(patch.questionCount, 0),
    order: parseStrArr(patch.order),
    yourTurn: patch.yourTurn === true,
    canVoteAudience: patch.canVoteAudience === true,
    youArePhoned: patch.youArePhoned === true,
    lifelinesUsed: parseStrArr(patch.lifelinesUsed),
    phoneSuggestion: typeof patch.phoneSuggestion === 'number' ? patch.phoneSuggestion : null,
    yourScore: num(patch.yourScore, 0),
  };
}
