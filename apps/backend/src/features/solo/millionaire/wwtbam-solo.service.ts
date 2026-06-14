import { randomUUID } from 'node:crypto';

import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { now, type EpochMs } from '@shared/time';
import { contentService } from '@features/content/content.service';

// Client-driven solo Who Wants to Be a Millionaire. The CLIENT owns pacing:
//   start → question → answer → next … → final
// The server keeps the answer indices secret until a guess resolves. No room, no socket, no engine.
// Sessions live in memory with an idle-TTL sweep — acceptable; losing a session on restart is fine.
//
// Solo mode disables Ask-the-Audience and Phone-a-Friend (no other players). Only 50/50 survives,
// and it is handled here as a one-shot server call that reveals which two wrong options to hide.
//
// Scoring: the ladder rung's face value if correct, 0 if wrong or timed-out. No speed weighting —
// the monetary value IS the reward. The full ladder is: [100, 200, 500, 1k, 2k, 5k, 10k, 25k, 50k, 100k].

const SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const LADDER = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;

// ── Config ────────────────────────────────────────────────────────────────────
export interface WwtbamSoloConfig {
  questionCount: number;
  secondsPerQuestion: number;
  category: string;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

export const normalizeConfig = (raw: unknown): WwtbamSoloConfig => {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    questionCount: clampInt(c.questionCount, 1, LADDER.length, LADDER.length),
    secondsPerQuestion: clampInt(c.secondsPerQuestion, 5, 120, 30),
    category: typeof c.category === 'string' && c.category.length > 0 ? c.category : 'general',
  };
};

// ── Session ───────────────────────────────────────────────────────────────────
interface Question {
  prompt: string;
  options: string[];
  answerIdx: number; // never sent to the client until after an answer
}

interface WwtbamSoloSession {
  soloId: string;
  config: WwtbamSoloConfig;
  questions: Question[]; // answers stay server-side until revealed
  idx: number; // current question index (0-based)
  answered: boolean[]; // per-question lock
  banked: number[]; // points awarded per question
  totalBanked: number;
  eliminated: boolean; // wrong answer → eliminated → game over
  fiftyFiftyUsed: boolean;
  over: boolean;
  createdAt: EpochMs;
  lastTouch: EpochMs;
}

// ── Public return types ───────────────────────────────────────────────────────
export interface WwtbamStartResult {
  soloId: string;
  questionCount: number;
  config: WwtbamSoloConfig;
  ladder: readonly number[];
}

export interface WwtbamQuestionView {
  idx: number;
  questionCount: number;
  prompt: string;
  options: string[];
  rung: number;
  secondsPerQuestion: number;
  fiftyFiftyAvailable: boolean;
}

export interface WwtbamAnswerResult {
  correct: boolean;
  answerIdx: number; // revealed
  rung: number; // value of this rung
  bankedThisQuestion: number;
  totalBanked: number;
  idx: number;
  questionCount: number;
  eliminated: boolean;
}

export interface WwtbamNextResult {
  done: boolean;
  idx: number;
  questionCount: number;
  totalBanked: number;
  eliminated: boolean;
}

export interface WwtbamFiftyFiftyResult {
  hidden: [number, number]; // two wrong option indices to hide
}

export interface WwtbamSnapshot {
  soloId: string;
  idx: number;
  questionCount: number;
  totalBanked: number;
  over: boolean;
  eliminated: boolean;
}

const rungValue = (idx: number): number => LADDER[Math.min(idx, LADDER.length - 1)] ?? 0;

// ── Service ───────────────────────────────────────────────────────────────────
export class WwtbamSoloService {
  private readonly sessions = new Map<string, WwtbamSoloSession>();
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
    for (const [id, s] of this.sessions) {
      if (s.lastTouch < cutoff) this.sessions.delete(id);
    }
  }

  private touch(s: WwtbamSoloSession): void {
    s.lastTouch = now();
  }

  private get(soloId: string): WwtbamSoloSession | undefined {
    const s = this.sessions.get(soloId);
    if (s) this.touch(s);
    return s;
  }

  // POST /start — fetch questions up front, build session. Answers never leave the server here.
  async start(rawConfig: unknown): Promise<ServiceResult<WwtbamStartResult>> {
    const config = normalizeConfig(rawConfig);

    const fetched = await contentService.resolveQuizQuestions({
      category: config.category,
      sample: config.questionCount,
    });

    // Fallback so a sparse DB never breaks a solo run.
    const raw =
      fetched.length > 0
        ? fetched
        : [{ prompt: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answerIdx: 1 }];

    const questions: Question[] = raw.slice(0, config.questionCount).map((q) => ({
      prompt: q.prompt,
      options: q.options,
      answerIdx: q.answerIdx,
    }));

    const actualCount = questions.length;
    const soloId = randomUUID();

    const session: WwtbamSoloSession = {
      soloId,
      config: { ...config, questionCount: actualCount },
      questions,
      idx: 0,
      answered: new Array(actualCount).fill(false),
      banked: new Array(actualCount).fill(0),
      totalBanked: 0,
      eliminated: false,
      fiftyFiftyUsed: false,
      over: false,
      createdAt: now(),
      lastTouch: now(),
    };

    this.sessions.set(soloId, session);
    return ServiceSuccess({
      soloId,
      questionCount: actualCount,
      config: session.config,
      ladder: LADDER,
    });
  }

  private questionView(s: WwtbamSoloSession): WwtbamQuestionView {
    const q = s.questions[s.idx];
    return {
      idx: s.idx,
      questionCount: s.config.questionCount,
      prompt: q?.prompt ?? '',
      options: q?.options ?? [],
      rung: rungValue(s.idx),
      secondsPerQuestion: s.config.secondsPerQuestion,
      fiftyFiftyAvailable: !s.fiftyFiftyUsed,
    };
  }

  // POST /question — current question (answer withheld). Idempotent: safe to call on refresh.
  question(soloId: string): ServiceResult<WwtbamQuestionView> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.eliminated || s.idx >= s.questions.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWwtbam.OVER, 409);
    }
    return ServiceSuccess(this.questionView(s));
  }

  // POST /answer — lock the question, reveal the answer, score the rung.
  // choiceIdx=-1 means a client-side timeout (0 points, still reveals, still eliminates).
  answer(soloId: string, choiceIdx: unknown, timeout = false): ServiceResult<WwtbamAnswerResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.eliminated || s.idx >= s.questions.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWwtbam.OVER, 409);
    }
    if (s.answered[s.idx]) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.soloWwtbam.ALREADY_ANSWERED, 409);
    }

    const choice = typeof choiceIdx === 'number' && Number.isInteger(choiceIdx) ? choiceIdx : -1;
    const q = s.questions[s.idx];
    if (!q) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);

    const correct = !timeout && choice === q.answerIdx;
    const rung = rungValue(s.idx);
    const bankedThisQuestion = correct ? rung : 0;

    s.answered[s.idx] = true;
    s.banked[s.idx] = bankedThisQuestion;
    s.totalBanked += bankedThisQuestion;
    if (!correct) s.eliminated = true;
    this.touch(s);

    return ServiceSuccess({
      correct,
      answerIdx: q.answerIdx,
      rung,
      bankedThisQuestion,
      totalBanked: s.totalBanked,
      idx: s.idx,
      questionCount: s.config.questionCount,
      eliminated: s.eliminated,
    });
  }

  // POST /next — advance to the next question.
  // If the player was eliminated or there are no more questions, done:true.
  // An unanswered question (e.g. client-side timer forced /next without /answer) auto-locks as timeout.
  next(soloId: string): ServiceResult<WwtbamNextResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over) {
      return ServiceSuccess({ done: true, idx: s.idx, questionCount: s.config.questionCount, totalBanked: s.totalBanked, eliminated: s.eliminated });
    }

    // Auto-lock unanswered current question as a timeout (0 points + eliminated).
    if (s.idx < s.answered.length && !s.answered[s.idx]) {
      s.answered[s.idx] = true;
      s.eliminated = true;
    }

    if (s.eliminated) {
      s.over = true;
      return ServiceSuccess({ done: true, idx: s.idx, questionCount: s.config.questionCount, totalBanked: s.totalBanked, eliminated: true });
    }

    s.idx += 1;
    if (s.idx >= s.questions.length) {
      s.over = true;
      return ServiceSuccess({ done: true, idx: s.idx, questionCount: s.config.questionCount, totalBanked: s.totalBanked, eliminated: false });
    }

    return ServiceSuccess({ done: false, idx: s.idx, questionCount: s.config.questionCount, totalBanked: s.totalBanked, eliminated: false });
  }

  // POST /fifty-fifty — reveal two wrong option indices to hide. One-shot; the client stores them.
  fiftyFifty(soloId: string): ServiceResult<WwtbamFiftyFiftyResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.eliminated || s.idx >= s.questions.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWwtbam.OVER, 409);
    }
    if (s.fiftyFiftyUsed) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.soloWwtbam.LIFELINE_USED, 409);
    }
    if (s.answered[s.idx]) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWwtbam.ALREADY_ANSWERED, 409);
    }

    const q = s.questions[s.idx];
    if (!q) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);

    // Pick 2 wrong indices deterministically (first two wrongs after the correct answer's position).
    const wrong = ([0, 1, 2, 3] as const).filter((i) => i !== q.answerIdx);
    const hidden: [number, number] = [wrong[0]!, wrong[1]!];

    s.fiftyFiftyUsed = true;
    this.touch(s);

    return ServiceSuccess({ hidden });
  }

  // GET /:soloId — snapshot for reconnect.
  snapshot(soloId: string): ServiceResult<WwtbamSnapshot> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    return ServiceSuccess({
      soloId,
      idx: s.idx,
      questionCount: s.config.questionCount,
      totalBanked: s.totalBanked,
      over: s.over,
      eliminated: s.eliminated,
    });
  }
}

export const wwtbamSoloService = new WwtbamSoloService();
