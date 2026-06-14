import { z } from 'zod';

import { MESSAGE_KEYS } from '@shared/messages/keys';
import type { EpochMs } from '@shared/time';
import { AudienceKind, EffectKind, GameCategory, GameId, GameMode, SystemActionType } from '@engine/constants';
import type {
  ActionCtx,
  Audience,
  GamePlugin,
  InitInput,
  RoundScore,
  ServiceResultAction,
  StepResult,
  TickCtx,
  ViewPatch,
} from '@engine/types';

import { projectBoard, projectTiming } from '../shared/view-helpers';

// Investigation (PRD §6.4 #17) — OPEN_PHASE. A rich case file (suspects, forensic reports, witness
// statements, interview transcripts, a timeline, and investigative tools whose lookups sometimes
// dead-end) is served to every device. Players work the case at their own pace within a time window,
// then submit a REASONED accusation: the culprit, the piece of evidence that proves it, and a
// confidence level. When the window closes (or everyone has locked in) the truth is revealed and
// scored. The solution, key evidence, and explanation are SERVER-ONLY until reveal.
//
// Backend phases are just investigate → reveal → done; the client adds its own briefing/accuse beats.

const Phase = { INVESTIGATE: 'investigate', REVEAL: 'reveal', DONE: 'done' } as const;
type Phase = (typeof Phase)[keyof typeof Phase];
const ActionType = { ACCUSE: 'investigation.accuse' } as const;
const TimerKey = { INVESTIGATE: 'investigate', REVEAL: 'reveal' } as const;
const EventType = { ACCUSE: 'investigation.accuse' } as const;

// Reasoned-accusation inputs.
const AlibiStatus = { CONFIRMED: 'confirmed', SHAKY: 'shaky', BROKEN: 'broken', UNCHECKED: 'unchecked' } as const;
const ReportKind = { AUTOPSY: 'autopsy', FORENSIC: 'forensic', FINANCIAL: 'financial', DIGITAL: 'digital' } as const;
const FindingFlag = { KEY: 'key', HERRING: 'herring', NONE: 'none' } as const;
const Reliability = { RELIABLE: 'reliable', QUESTIONABLE: 'questionable', HOSTILE: 'hostile' } as const;
const LineRole = { Q: 'q', A: 'a' } as const;
const ToolOutcome = { HIT: 'hit', PARTIAL: 'partial', DEAD_END: 'dead_end' } as const;
const ToolIcon = { IDENTITY: 'identity', PHONE_RECORDS: 'phone_records', CALL_LOG: 'call_log', TRIANGULATION: 'triangulation', CRIME_DB: 'crime_db' } as const;
const Confidence = { HUNCH: 'hunch', SOLID: 'solid', CERTAIN: 'certain' } as const;
type Confidence = (typeof Confidence)[keyof typeof Confidence];

const configSchema = z.object({
  investigateSeconds: z.number().int().positive().default(300), // default 5 min (host picks 5–30)
  revealSeconds: z.number().int().positive().default(12),
  // Optional: the host chose a specific case by key. Empty ⇒ the resolver draws a random one.
  caseKey: z.string().default(''),
});
type Config = z.infer<typeof configSchema>;

// ── Rich case content ─────────────────────────────────────────────────────────
const suspect = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().nonnegative(),
  role: z.string(),
  motive: z.string(),
  alibi: z.string(),
  alibiStatus: z.nativeEnum(AlibiStatus).default(AlibiStatus.UNCHECKED),
  phone: z.string().default(''),
  note: z.string().default(''),
});
const reportField = z.object({ label: z.string(), value: z.string() });
const finding = z.object({ heading: z.string(), detail: z.string(), flag: z.nativeEnum(FindingFlag).default(FindingFlag.NONE) });
const report = z.object({
  id: z.string(),
  kind: z.nativeEnum(ReportKind),
  title: z.string(),
  subtitle: z.string().default(''),
  header: z.array(reportField).default([]),
  findings: z.array(finding).default([]),
});
const witness = z.object({
  id: z.string(),
  name: z.string(),
  relation: z.string(),
  statement: z.string(),
  reliability: z.nativeEnum(Reliability).default(Reliability.RELIABLE),
});
const transcriptLine = z.object({ speaker: z.string(), role: z.nativeEnum(LineRole), text: z.string() });
const transcript = z.object({ id: z.string(), suspectId: z.string(), title: z.string(), lines: z.array(transcriptLine).default([]) });
const timelineEvent = z.object({ time: z.string(), event: z.string(), source: z.string().default(''), conflict: z.boolean().default(false) });
const lookupRow = z.object({ label: z.string(), value: z.string() });
const lookupResult = z.object({
  query: z.string(),
  outcome: z.nativeEnum(ToolOutcome),
  rows: z.array(lookupRow).default([]),
  note: z.string().default(''),
});
const tool = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().default(''),
  icon: z.nativeEnum(ToolIcon),
  results: z.array(lookupResult).default([]),
});

const contentSchema = z.object({
  title: z.string(),
  category: z.string().default('Investigation'),
  brief: z.string(),
  suspects: z.array(suspect).min(2),
  reports: z.array(report).default([]),
  witnesses: z.array(witness).default([]),
  transcripts: z.array(transcript).default([]),
  timeline: z.array(timelineEvent).default([]),
  tools: z.array(tool).default([]),
  solutionSuspectId: z.string(),
  keyEvidenceId: z.string().default(''),
  explanation: z.string().default(''),
});
type Content = z.infer<typeof contentSchema>;

const actionSchema = z.object({
  type: z.literal(ActionType.ACCUSE),
  suspectId: z.string(),
  evidenceId: z.string().default(''),
  confidence: z.nativeEnum(Confidence).default(Confidence.SOLID),
});
type Action = z.infer<typeof actionSchema>;

interface Accusation {
  playerId: string;
  suspectId: string;
  evidenceId: string;
  confidence: Confidence;
  at: EpochMs;
}

interface State {
  phase: Phase;
  case: Content;
  revealSeconds: number;
  deadline: EpochMs;
  startedAt: EpochMs;
  investigateSeconds: number;
  rosterSize: number; // total players at start — drives early-advance when everyone has locked in
  playerIds: string[]; // every player at start — so the final board includes 0-scorers, not just solvers
  accusations: Accusation[];
}

// ── Reasoned scoring ──────────────────────────────────────────────────────────
// Right SUSPECT scores a speed-graded base (faster correct accusers rank higher). Naming the right
// KEY EVIDENCE adds a flat bonus. CONFIDENCE scales the suspect base (a confident-and-right call is
// worth more). Wrong suspect = 0 (confidence can't lose points — solo-friendly, no negative scores).
const SUSPECT_MAX = 800;
const SUSPECT_MIN = 400;
const EVIDENCE_BONUS = 200;
const CONFIDENCE_MULT: Record<Confidence, number> = { [Confidence.HUNCH]: 0.8, [Confidence.SOLID]: 1, [Confidence.CERTAIN]: 1.15 };

const scoreMap = (state: State): Record<string, number> => {
  const solution = state.case.solutionSuspectId;
  const keyEvidence = state.case.keyEvidenceId;
  const correct = state.accusations.filter((a) => a.suspectId === solution).sort((a, b) => a.at - b.at);
  const out: Record<string, number> = {};
  correct.forEach((a, rank) => {
    // Rank-graded base: fastest gets SUSPECT_MAX, each later correct steps down toward SUSPECT_MIN.
    const base = Math.max(SUSPECT_MIN, SUSPECT_MAX - rank * 100);
    const withConfidence = base * CONFIDENCE_MULT[a.confidence];
    const bonus = keyEvidence !== '' && a.evidenceId === keyEvidence ? EVIDENCE_BONUS : 0;
    out[a.playerId] = Math.round(withConfidence + bonus);
  });
  return out;
};

// The final board must show EVERY player — solvers AND those who guessed wrong / never accused
// (score 0) — so the result standings aren't just the winner. Seed all roster ids to 0, overlay the
// solvers' scores.
const boardScores = (state: State): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of state.playerIds) out[id] = 0;
  for (const [id, pts] of Object.entries(scoreMap(state))) out[id] = pts;
  return out;
};

const MAX_POINTS = Math.round(SUSPECT_MAX * CONFIDENCE_MULT[Confidence.CERTAIN]) + EVIDENCE_BONUS;

// Strip the answer (and any secret) from the case for the pre-reveal projection.
const publicCase = (c: Content): Omit<Content, 'solutionSuspectId' | 'keyEvidenceId' | 'explanation'> => {
  const { solutionSuspectId: _s, keyEvidenceId: _k, explanation: _e, ...rest } = c;
  return rest;
};

export const investigationGame: GamePlugin<Config, State, Action, Content> = {
  manifest: {
    id: GameId.INVESTIGATION,
    title: 'Investigation',
    category: GameCategory.IMMERSIVE,
    mode: GameMode.OPEN_PHASE,
    players: { min: 2, max: 8, recommendedMax: 8 },
    capabilities: {},
    // Solo-able: each player investigates + accuses independently and is scored against the
    // revealed truth — no peer dependency.
    solo: { supported: true },
  },
  configSchema,
  contentSchema,
  actionSchema,

  init(input: InitInput<Config, Content>): StepResult<State> {
    const d = input.startedAt + input.config.investigateSeconds * 1000;
    return {
      state: {
        phase: Phase.INVESTIGATE,
        case: input.content,
        revealSeconds: input.config.revealSeconds,
        deadline: d,
        startedAt: input.startedAt,
        investigateSeconds: input.config.investigateSeconds,
        rosterSize: input.players.length,
        playerIds: input.players.map((p) => p.id),
        accusations: [],
      },
      effects: [{ kind: EffectKind.START_TIMER, key: TimerKey.INVESTIGATE, fireAt: d }, { kind: EffectKind.BROADCAST }],
    };
  },

  onAction(state: State, action: Action | ServiceResultAction, ctx: ActionCtx): StepResult<State> {
    if (action.type === SystemActionType.SERVICE_RESULT) return { state, effects: [] };
    if (state.phase !== Phase.INVESTIGATE) return { state, effects: [] };
    // The accusation must name a real suspect; a player may revise it until the window closes.
    if (!state.case.suspects.some((s) => s.id === action.suspectId)) return { state, effects: [] };

    const accusation: Accusation = {
      playerId: ctx.actor.id,
      suspectId: action.suspectId,
      evidenceId: action.evidenceId,
      confidence: action.confidence,
      at: ctx.now,
    };
    const accusations = [...state.accusations.filter((a) => a.playerId !== ctx.actor.id), accusation];
    const next: State = { ...state, accusations };

    // Persist a real audit trail of who accused whom (the old plugin persisted an empty payload).
    const persist = {
      kind: EffectKind.PERSIST_EVENT,
      event: { type: EventType.ACCUSE, data: { suspectId: action.suspectId, evidenceId: action.evidenceId, confidence: action.confidence } },
    } as const;

    // EARLY ADVANCE: once every player at the table has locked in, jump straight to reveal instead of
    // making the room wait out the clock. (Solo: rosterSize is 1, so the single accusation ends it.)
    const distinctAccusers = new Set(accusations.map((a) => a.playerId)).size;
    if (distinctAccusers >= state.rosterSize) {
      const d = ctx.now + state.revealSeconds * 1000;
      return {
        state: { ...next, phase: Phase.REVEAL, deadline: d },
        effects: [
          { kind: EffectKind.CLEAR_TIMER, key: TimerKey.INVESTIGATE },
          persist,
          { kind: EffectKind.BROADCAST },
          { kind: EffectKind.ROUND_ENDED },
          { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d },
        ],
      };
    }

    return {
      state: next,
      effects: [{ kind: EffectKind.TO_PLAYER, playerId: ctx.actor.id }, persist],
    };
  },

  onTick(state: State, nowMs: EpochMs, _ctx: TickCtx): StepResult<State> {
    if (state.phase === Phase.INVESTIGATE) {
      const d = nowMs + state.revealSeconds * 1000;
      return {
        state: { ...state, phase: Phase.REVEAL, deadline: d },
        effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.ROUND_ENDED }, { kind: EffectKind.START_TIMER, key: TimerKey.REVEAL, fireAt: d }],
      };
    }
    if (state.phase === Phase.REVEAL) {
      return { state: { ...state, phase: Phase.DONE }, effects: [{ kind: EffectKind.BROADCAST }, { kind: EffectKind.GAME_ENDED }] };
    }
    return { state, effects: [] };
  },

  view(state: State, audience: Audience): ViewPatch {
    const c = state.case;
    const reveal = state.phase === Phase.REVEAL || state.phase === Phase.DONE;
    // The full case file (minus the answer) is served to everyone — players explore it. The solution,
    // key evidence, and explanation are withheld until reveal.
    const pub = publicCase(c);
    const base: ViewPatch = {
      phase: state.phase,
      title: pub.title,
      category: pub.category,
      brief: pub.brief,
      suspects: pub.suspects,
      reports: pub.reports,
      witnesses: pub.witnesses,
      transcripts: pub.transcripts,
      timeline: pub.timeline,
      tools: pub.tools,
      revealSeconds: state.revealSeconds,
      ...projectTiming(state.deadline, reveal ? state.revealSeconds : state.investigateSeconds),
    };
    if (reveal) {
      base.solutionSuspectId = c.solutionSuspectId;
      base.keyEvidenceId = c.keyEvidenceId;
      base.explanation = c.explanation;
      base.accusations = state.accusations.map((a) => ({ playerId: a.playerId, suspectId: a.suspectId, evidenceId: a.evidenceId }));
      // Board = ALL players (0 for non-solvers); roundDelta = the solver deltas (so winners light up).
      base.board = projectBoard(boardScores(state), scoreMap(state));
    }
    if (audience.kind === AudienceKind.PLAYER) {
      const mine = state.accusations.find((a) => a.playerId === audience.playerId);
      base.yourAccusation = mine?.suspectId ?? null;
      base.yourEvidence = mine?.evidenceId ?? null;
      base.yourConfidence = mine?.confidence ?? null;
      base.locked = mine !== undefined;
      if (reveal) base.yourScore = scoreMap(state)[audience.playerId] ?? 0;
    }
    return base;
  },

  scoreRound(state: State): RoundScore {
    const deltas = Object.entries(scoreMap(state)).map(([playerId, points]) => ({ playerId, points, reason: MESSAGE_KEYS.common.OK }));
    return { deltas, maxPoints: MAX_POINTS };
  },

  isOver(state: State): boolean {
    return state.phase === Phase.DONE;
  },
};
