import { randomUUID } from 'node:crypto';

import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { now, type EpochMs } from '@shared/time';
import { pickGameWords } from '@games/shared/word-picker';
import { maskPositions, maskedString } from '@games/missing-letters/missing-letters.mask';

// Client-driven solo Missing Letters. Unlike the room/socket engine, the CLIENT owns pacing here:
// it requests a round, runs its own countdown, submits a guess with the elapsed time, then asks for
// the next round when the player is ready. The server is a thin stateful surface that (a) keeps the
// answers secret until a guess is submitted, (b) validates guesses, and (c) computes speed-weighted
// score. No room, no socket, no engine timers. Sessions live in memory with an idle TTL sweep — a
// solo run is ephemeral; losing it on restart is acceptable (same as the room registry).

// ── Tuning ──────────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle → swept
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Speed-weighted scoring: a correct guess scores between FLOOR and MAX, decaying linearly with the
// fraction of the round window the player used. Instant → MAX; at/after the deadline → FLOOR. Wrong
// or timed-out (no guess) → 0. elapsedMs is reported by the client (shown → submitted); in solo
// there's no opponent, so trusting the client costs nothing.
const SCORE_MAX = 1000;
const SCORE_FLOOR = 400;

export const scoreGuess = (correct: boolean, elapsedMs: number, secondsPerRound: number): number => {
  if (!correct) return 0;
  const windowMs = Math.max(1, secondsPerRound * 1000);
  const used = Math.min(1, Math.max(0, elapsedMs) / windowMs); // 0 (instant) … 1 (used full window)
  return Math.round(SCORE_MAX - (SCORE_MAX - SCORE_FLOOR) * used);
};

// ── Config ──────────────────────────────────────────────────────────────────
// Mirrors the relevant fields of the plugin's config (rounds/secondsPerRound/hiddenCount/length
// band). Defaults match missing-letters.plugin.ts / missing-letters.content.ts so solo and
// multiplayer feel identical. Clamped to sane bounds (the client is untrusted input).
export interface MlSoloConfig {
  rounds: number;
  secondsPerRound: number;
  hiddenCount: number;
  minLen: number;
  maxLen: number;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

export const normalizeConfig = (raw: unknown): MlSoloConfig => {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const minLen = clampInt(c.minLen, 3, 12, 4);
  const maxLen = clampInt(c.maxLen, minLen, 14, Math.max(minLen, 8));
  return {
    rounds: clampInt(c.rounds, 1, 20, 8),
    secondsPerRound: clampInt(c.secondsPerRound, 5, 120, 20),
    hiddenCount: clampInt(c.hiddenCount, 1, 3, 2),
    minLen,
    maxLen,
  };
};

// ── Session state ─────────────────────────────────────────────────────────────
interface RoundWord {
  answer: string;
  revealed: number[];
}

interface MlSoloSession {
  soloId: string;
  config: MlSoloConfig;
  words: RoundWord[]; // one per round; answers never leave the server until a guess resolves
  idx: number; // current round index (0-based)
  answered: boolean[]; // per-round: has this round been guessed (locked)?
  scores: number[]; // per-round points awarded
  totalScore: number;
  over: boolean;
  createdAt: EpochMs;
  lastTouch: EpochMs;
}

// What a round looks like to the client — answer withheld.
export interface MlRoundView {
  idx: number;
  rounds: number;
  masked: string;
  length: number;
  secondsPerRound: number;
}

export interface MlGuessResult {
  correct: boolean;
  points: number;
  answer: string; // revealed only AFTER the guess (this is the reveal moment)
  totalScore: number;
  idx: number;
  rounds: number;
}

export interface MlNextResult {
  done: boolean;
  idx: number;
  rounds: number;
  totalScore: number;
}

export interface MlSnapshot {
  soloId: string;
  idx: number;
  rounds: number;
  totalScore: number;
  over: boolean;
}

export class MlSoloService {
  private readonly sessions = new Map<string, MlSoloSession>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor() {
    this.startSweeper();
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Don't keep the process alive just for the sweeper.
    this.sweeper.unref?.();
  }

  private sweep(): void {
    const cutoff = now() - SESSION_TTL_MS;
    for (const [id, s] of this.sessions) {
      if (s.lastTouch < cutoff) this.sessions.delete(id);
    }
  }

  private touch(s: MlSoloSession): void {
    s.lastTouch = now();
  }

  private get(soloId: string): MlSoloSession | undefined {
    const s = this.sessions.get(soloId);
    if (s) this.touch(s);
    return s;
  }

  // POST /start — pick all words up front, build the session, return the round count only.
  async start(rawConfig: unknown): Promise<ServiceResult<{ soloId: string; rounds: number; config: MlSoloConfig }>> {
    const config = normalizeConfig(rawConfig);
    const picked = await pickGameWords({ count: config.rounds, minLen: config.minLen, maxLen: config.maxLen });
    // Resolver-style fallback so a sparse DB never breaks a solo run.
    const list = picked.length > 0 ? picked : ['banana', 'orange', 'pencil', 'guitar'];
    const words: RoundWord[] = list
      .slice(0, config.rounds)
      .map((answer) => ({ answer, revealed: maskPositions(answer, config.hiddenCount, `mlsolo:${answer}:${randomUUID()}`) }));
    // If the DB returned fewer words than requested, the game has as many rounds as we have words.
    const rounds = words.length;

    const soloId = randomUUID();
    const session: MlSoloSession = {
      soloId,
      config: { ...config, rounds },
      words,
      idx: 0,
      answered: new Array(rounds).fill(false),
      scores: new Array(rounds).fill(0),
      totalScore: 0,
      over: false,
      createdAt: now(),
      lastTouch: now(),
    };
    this.sessions.set(soloId, session);
    return ServiceSuccess({ soloId, rounds, config: session.config });
  }

  private roundView(s: MlSoloSession): MlRoundView {
    const word = s.words[s.idx];
    return {
      idx: s.idx,
      rounds: s.config.rounds,
      masked: word ? maskedString(word.answer, word.revealed) : '',
      length: word?.answer.length ?? 0,
      secondsPerRound: s.config.secondsPerRound,
    };
  }

  // POST /round — the current round's masked word (answer withheld). Idempotent: calling it twice
  // for the same round returns the same view (so a refresh mid-round is safe).
  round(soloId: string): ServiceResult<MlRoundView> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.idx >= s.words.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloMl.OVER, 409);
    }
    return ServiceSuccess(this.roundView(s));
  }

  // POST /guess — validate the guess, award speed-weighted points, reveal the answer. One shot per
  // round; a second guess for the same round is rejected (already locked). `timeout:true` is the
  // honest "ran out of time" path: empty text is allowed, scores 0, and still reveals the answer so
  // the client can show the reveal screen.
  guess(soloId: string, text: unknown, elapsedMs: unknown, timeout = false): ServiceResult<MlGuessResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.idx >= s.words.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloMl.OVER, 409);
    }
    if (s.answered[s.idx]) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.soloMl.ALREADY_ANSWERED, 409);
    }
    const guessText = typeof text === 'string' ? text.trim() : '';
    if (guessText.length === 0 && !timeout) {
      return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, { text: ['Required.'] });
    }
    const word = s.words[s.idx];
    if (!word) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);

    const elapsed = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : s.config.secondsPerRound * 1000;
    // A timeout never scores, even if the (stale) text happens to match.
    const correct = !timeout && guessText.toLowerCase() === word.answer.toLowerCase();
    const points = scoreGuess(correct, elapsed, s.config.secondsPerRound);

    s.answered[s.idx] = true;
    s.scores[s.idx] = points;
    s.totalScore += points;
    this.touch(s);

    return ServiceSuccess({
      correct,
      points,
      answer: word.answer,
      totalScore: s.totalScore,
      idx: s.idx,
      rounds: s.config.rounds,
    });
  }

  // POST /next — advance to the next round. `done:true` (and over) once the last round is consumed.
  // Auto-locks the current round as a timeout (0 points) if it was never guessed, so skipping a
  // round without answering is honest.
  next(soloId: string): ServiceResult<MlNextResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over) {
      return ServiceSuccess({ done: true, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
    }
    // Unanswered current round → counts as a timeout (0).
    if (s.idx < s.answered.length && !s.answered[s.idx]) s.answered[s.idx] = true;

    s.idx += 1;
    if (s.idx >= s.words.length) {
      s.over = true;
      s.idx = s.words.length; // clamp
      return ServiceSuccess({ done: true, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
    }
    return ServiceSuccess({ done: false, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
  }

  // GET /:soloId — snapshot for reconnect/poll.
  snapshot(soloId: string): ServiceResult<MlSnapshot> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    return ServiceSuccess({ soloId, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore, over: s.over });
  }
}

export const mlSoloService = new MlSoloService();
