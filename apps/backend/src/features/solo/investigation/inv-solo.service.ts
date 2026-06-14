import { randomUUID } from 'node:crypto';

import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { now, type EpochMs } from '@shared/time';
import { contentService } from '@features/content/content.service';
import { DEFAULT_RATING_FILTER } from '@features/content/content.constants';

// Client-driven solo Investigation. The server draws a case, serves the full file with the SOLUTION
// withheld, then accepts ONE reasoned accusation (suspect + key evidence + confidence) and scores it
// against the truth — speed-weighted, matching the plugin formula. No room, no socket, no engine.
// Sessions are in-memory with an idle TTL sweep.

const SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Scoring (mirrors investigation.plugin.ts): right suspect = speed-graded base scaled by confidence;
// + naming the right key evidence = a flat bonus; wrong suspect = 0. Solo has no rank (one accuser),
// so the base is speed-graded by elapsed time within the window instead of finishing rank.
const SUSPECT_MAX = 800;
const SUSPECT_MIN = 400;
const EVIDENCE_BONUS = 200;
const Confidence = { HUNCH: 'hunch', SOLID: 'solid', CERTAIN: 'certain' } as const;
type Confidence = (typeof Confidence)[keyof typeof Confidence];
const CONFIDENCE_MULT: Record<Confidence, number> = { hunch: 0.8, solid: 1, certain: 1.15 };

export const scoreAccusation = (
  correctSuspect: boolean,
  correctEvidence: boolean,
  confidence: Confidence,
  elapsedMs: number,
  investigateSeconds: number,
): number => {
  if (!correctSuspect) return 0;
  const windowMs = Math.max(1, investigateSeconds * 1000);
  const used = Math.min(1, Math.max(0, elapsedMs) / windowMs); // 0 (instant) … 1 (full window)
  const base = SUSPECT_MAX - (SUSPECT_MAX - SUSPECT_MIN) * used;
  const withConfidence = base * CONFIDENCE_MULT[confidence];
  const bonus = correctEvidence ? EVIDENCE_BONUS : 0;
  return Math.round(withConfidence + bonus);
};

// ── Config ───────────────────────────────────────────────────────────────────
export interface InvSoloConfig {
  investigateSeconds: number;
  caseKey: string; // '' ⇒ draw a random case
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

export const normalizeConfig = (raw: unknown): InvSoloConfig => {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    investigateSeconds: clampInt(c.investigateSeconds, 30, 3600, 300),
    caseKey: typeof c.caseKey === 'string' ? c.caseKey : '',
  };
};

// The case as stored (loose — it comes from the DB). We only need the answer fields server-side.
interface StoredCase {
  title?: unknown;
  category?: unknown;
  brief?: unknown;
  suspects?: unknown;
  reports?: unknown;
  witnesses?: unknown;
  transcripts?: unknown;
  timeline?: unknown;
  tools?: unknown;
  solutionSuspectId?: unknown;
  keyEvidenceId?: unknown;
  explanation?: unknown;
}

interface InvSoloSession {
  soloId: string;
  config: InvSoloConfig;
  theCase: StoredCase;
  startedAt: EpochMs;
  answered: boolean;
  score: number;
  lastTouch: EpochMs;
}

// The case as served to the client — answer fields stripped.
const publicCase = (c: StoredCase): Record<string, unknown> => ({
  title: c.title ?? 'Investigation',
  category: c.category ?? 'Investigation',
  brief: c.brief ?? '',
  suspects: c.suspects ?? [],
  reports: c.reports ?? [],
  witnesses: c.witnesses ?? [],
  transcripts: c.transcripts ?? [],
  timeline: c.timeline ?? [],
  tools: c.tools ?? [],
});

export interface InvStartResult {
  soloId: string;
  investigateSeconds: number;
  theCase: Record<string, unknown>;
}

export interface InvAccuseResult {
  correct: boolean;
  correctEvidence: boolean;
  points: number;
  solutionSuspectId: string;
  keyEvidenceId: string;
  explanation: string;
}

export interface InvSnapshot {
  soloId: string;
  over: boolean;
  score: number;
}

export class InvSoloService {
  private readonly sessions = new Map<string, InvSoloSession>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweeper();
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  private sweep(): void {
    const cutoff = now() - SESSION_TTL_MS;
    for (const [id, s] of this.sessions) if (s.lastTouch < cutoff) this.sessions.delete(id);
  }

  private get(soloId: string): InvSoloSession | undefined {
    const s = this.sessions.get(soloId);
    if (s) s.lastTouch = now();
    return s;
  }

  // GET /cases — the lightweight case list for the picker (no spoilers).
  async listCases(): Promise<ServiceResult<{ cases: { key: string; title: string; category: string; difficulty: number; suspectCount: number }[] }>> {
    const cases = await contentService.listInvestigationCases({ filter: DEFAULT_RATING_FILTER });
    return ServiceSuccess({ cases });
  }

  // POST /start — draw a case (the chosen caseKey, else random), serve the file (no solution), open
  // the session.
  async start(rawConfig: unknown): Promise<ServiceResult<InvStartResult>> {
    const config = normalizeConfig(rawConfig);
    let theCase: StoredCase | null = null;
    if (config.caseKey !== '') {
      theCase = (await contentService.investigationCaseByKey(config.caseKey, { filter: DEFAULT_RATING_FILTER })) as StoredCase | null;
    }
    if (!theCase) {
      const cases = await contentService.resolveInvestigationCases({ filter: DEFAULT_RATING_FILTER, sample: 1 });
      theCase = (cases[0] ?? null) as StoredCase | null;
    }
    if (!theCase || typeof theCase.solutionSuspectId !== 'string') {
      return ServiceError(ERROR_CODES.NOT_FOUND, MESSAGE_KEYS.soloInv.NO_CASE, 404);
    }
    const soloId = randomUUID();
    this.sessions.set(soloId, { soloId, config, theCase, startedAt: now(), answered: false, score: 0, lastTouch: now() });
    return ServiceSuccess({ soloId, investigateSeconds: config.investigateSeconds, theCase: publicCase(theCase) });
  }

  // POST /accuse — score the reasoned accusation against the truth, reveal the answer. One shot.
  accuse(soloId: string, suspectId: unknown, evidenceId: unknown, confidence: unknown, elapsedMs: unknown): ServiceResult<InvAccuseResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.answered) return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.soloInv.ALREADY_ACCUSED, 409);

    const sid = typeof suspectId === 'string' ? suspectId : '';
    if (sid === '') return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, { suspectId: ['Required.'] });

    const solution = String(s.theCase.solutionSuspectId ?? '');
    const keyEvidence = String(s.theCase.keyEvidenceId ?? '');
    const conf: Confidence = confidence === Confidence.HUNCH || confidence === Confidence.CERTAIN ? confidence : Confidence.SOLID;
    const eid = typeof evidenceId === 'string' ? evidenceId : '';
    const elapsed = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : s.config.investigateSeconds * 1000;

    const correct = sid === solution;
    const correctEvidence = correct && keyEvidence !== '' && eid === keyEvidence;
    const points = scoreAccusation(correct, correctEvidence, conf, elapsed, s.config.investigateSeconds);

    s.answered = true;
    s.score = points;

    return ServiceSuccess({
      correct,
      correctEvidence,
      points,
      solutionSuspectId: solution,
      keyEvidenceId: keyEvidence,
      explanation: String(s.theCase.explanation ?? ''),
    });
  }

  // GET /:soloId — snapshot for reconnect/poll.
  snapshot(soloId: string): ServiceResult<InvSnapshot> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    return ServiceSuccess({ soloId, over: s.answered, score: s.score });
  }
}

export const invSoloService = new InvSoloService();
