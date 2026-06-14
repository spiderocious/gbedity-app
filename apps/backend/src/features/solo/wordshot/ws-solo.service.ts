import { randomUUID } from 'node:crypto';

import { ERROR_CODES } from '@shared/http/error-codes';
import { ServiceError, ServiceSuccess, type ServiceResult } from '@shared/http/service-result';
import { MESSAGE_KEYS } from '@shared/messages';
import { now, type EpochMs } from '@shared/time';
import { contentService } from '@features/content/content.service';
import { validationService, DupHandling } from '@features/validation/validation.service';
import {
  generateLetters,
  assignCategories,
  LetterDifficulty,
} from '@games/shared/letter-category';

// Client-driven solo Wordshot. Each round: server gives the player a letter + category; player
// submits a word that fits both. The server validates the word (via validationService) and awards
// speed-weighted points (500–1000). No room, no socket, no engine timers.
//
// Content is resolved exactly as wordshot.content.ts: generateLetters + assignCategories +
// wordCount skip filter. Sessions are in-memory with an idle TTL sweep.

const SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Speed-weighted scoring: mirrors the plugin formula (0.5 + 0.5 * (1 - used)) scaled to 1000.
// Instant → 1000; at/after the deadline → 500. Wrong or timeout → 0.
const SCORE_MAX = 1000;
const SCORE_FLOOR = 500;

export const scoreGuess = (correct: boolean, elapsedMs: number, secondsPerRound: number): number => {
  if (!correct) return 0;
  const windowMs = Math.max(1, secondsPerRound * 1000);
  const used = Math.min(1, Math.max(0, elapsedMs) / windowMs);
  return Math.round(SCORE_MAX - (SCORE_MAX - SCORE_FLOOR) * used);
};

// ── Config ───────────────────────────────────────────────────────────────────
export interface WsSoloConfig {
  rounds: number;
  secondsPerRound: number;
  letterDifficulty: LetterDifficulty;
  enabledCategories: string[]; // [] = all available
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

export const normalizeConfig = (raw: unknown): WsSoloConfig => {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const rawDiff = c.letterDifficulty;
  const letterDifficulty =
    rawDiff === LetterDifficulty.COMMON_ONLY
      ? LetterDifficulty.COMMON_ONLY
      : rawDiff === LetterDifficulty.INCLUDES_QXZ
        ? LetterDifficulty.INCLUDES_QXZ
        : LetterDifficulty.MIXED;
  const enabledCategories = Array.isArray(c.enabledCategories)
    ? (c.enabledCategories as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return {
    rounds: clampInt(c.rounds, 1, 20, 10),
    secondsPerRound: clampInt(c.secondsPerRound, 5, 120, 20),
    letterDifficulty,
    enabledCategories,
  };
};

// ── Session state ─────────────────────────────────────────────────────────────
interface RoundPlan {
  letter: string;
  category: string;
}

interface WsSoloSession {
  soloId: string;
  config: WsSoloConfig;
  plan: RoundPlan[];
  idx: number;
  answered: boolean[];
  scores: number[];
  totalScore: number;
  over: boolean;
  createdAt: EpochMs;
  lastTouch: EpochMs;
}

// What a round looks like to the client — just letter + category, no answer to hide.
export interface WsRoundView {
  idx: number;
  rounds: number;
  letter: string;
  category: string;
  secondsPerRound: number;
}

export interface WsGuessResult {
  correct: boolean;
  points: number;
  totalScore: number;
  idx: number;
  rounds: number;
  suggestion?: string; // fuzzy near-miss from the validation service
}

export interface WsNextResult {
  done: boolean;
  idx: number;
  rounds: number;
  totalScore: number;
}

export interface WsSnapshot {
  soloId: string;
  idx: number;
  rounds: number;
  totalScore: number;
  over: boolean;
}

const DEFAULT_ON = ['name', 'city', 'country'];

export class WsSoloService {
  private readonly sessions = new Map<string, WsSoloSession>();
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

  private touch(s: WsSoloSession): void {
    s.lastTouch = now();
  }

  private get(soloId: string): WsSoloSession | undefined {
    const s = this.sessions.get(soloId);
    if (s) this.touch(s);
    return s;
  }

  // POST /start — resolve round plan (letter + category per round), build session.
  async start(rawConfig: unknown): Promise<ServiceResult<{ soloId: string; rounds: number; config: WsSoloConfig }>> {
    const config = normalizeConfig(rawConfig);

    // Mirror wordshot.content.ts: pick enabled categories, over-generate letters, skip empty pairs.
    const allCats = await contentService.wordCategories();
    const DEFAULT_ON_FILTERED = DEFAULT_ON.filter((c) => allCats.includes(c));
    const enabled =
      config.enabledCategories.length > 0
        ? Array.from(new Set([...config.enabledCategories, ...DEFAULT_ON_FILTERED])).filter((c) => allCats.includes(c))
        : allCats;
    const activeCats = enabled.length > 0 ? enabled : allCats;

    const seed = randomUUID();
    const letters = generateLetters(seed, config.rounds * 3, config.letterDifficulty);
    const cats = assignCategories(seed, letters, activeCats);

    const plan: RoundPlan[] = [];
    for (let i = 0; i < letters.length && plan.length < config.rounds; i += 1) {
      const letter = letters[i]!;
      const category = cats[i]!;
      const count = await contentService.wordCount(category, letter);
      if (count > 0) plan.push({ letter, category });
    }
    // Fallback: never leave the player with an empty plan.
    if (plan.length === 0) plan.push({ letter: 'a', category: activeCats[0] ?? 'animal' });

    const rounds = plan.length;
    const soloId = randomUUID();
    const session: WsSoloSession = {
      soloId,
      config: { ...config, rounds },
      plan,
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

  private roundView(s: WsSoloSession): WsRoundView {
    const round = s.plan[s.idx];
    return {
      idx: s.idx,
      rounds: s.config.rounds,
      letter: round?.letter ?? 'a',
      category: round?.category ?? '',
      secondsPerRound: s.config.secondsPerRound,
    };
  }

  // POST /round — current round's letter + category. Idempotent (safe to call on refresh).
  round(soloId: string): ServiceResult<WsRoundView> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.idx >= s.plan.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWs.OVER, 409);
    }
    return ServiceSuccess(this.roundView(s));
  }

  // POST /guess — validate the word against the round's letter+category, award speed-weighted
  // points. One shot per round; a second attempt is rejected. `timeout:true` is the client's
  // honest "ran out of time" path: scores 0, no validation, locks the round.
  async guess(soloId: string, text: unknown, elapsedMs: unknown, timeout = false): Promise<ServiceResult<WsGuessResult>> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over || s.idx >= s.plan.length) {
      return ServiceError(ERROR_CODES.BAD_REQUEST, MESSAGE_KEYS.soloWs.OVER, 409);
    }
    if (s.answered[s.idx]) {
      return ServiceError(ERROR_CODES.CONFLICT, MESSAGE_KEYS.soloWs.ALREADY_ANSWERED, 409);
    }

    const guessText = typeof text === 'string' ? text.trim() : '';
    if (guessText.length === 0 && !timeout) {
      return ServiceError(ERROR_CODES.VALIDATION_ERROR, MESSAGE_KEYS.common.VALIDATION_FAILED, 422, { text: ['Required.'] });
    }

    const round = s.plan[s.idx];
    if (!round) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);

    const elapsed = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : s.config.secondsPerRound * 1000;

    let correct = false;
    let suggestion: string | undefined;

    if (!timeout && guessText.length > 0) {
      const verdict = await validationService.validateWord({
        word: guessText,
        category: round.category,
        startsWith: round.letter,
        dupHandling: DupHandling.STRICT,
      });
      correct = verdict.valid;
      suggestion = verdict.suggestion;
    }

    const points = scoreGuess(correct, elapsed, s.config.secondsPerRound);

    s.answered[s.idx] = true;
    s.scores[s.idx] = points;
    s.totalScore += points;
    this.touch(s);

    const result: WsGuessResult = {
      correct,
      points,
      totalScore: s.totalScore,
      idx: s.idx,
      rounds: s.config.rounds,
      ...(suggestion !== undefined && { suggestion }),
    };
    return ServiceSuccess(result);
  }

  // POST /next — advance to the next round. Unanswered current round is auto-locked as 0.
  next(soloId: string): ServiceResult<WsNextResult> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    if (s.over) {
      return ServiceSuccess({ done: true, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
    }
    if (s.idx < s.answered.length && !s.answered[s.idx]) s.answered[s.idx] = true;

    s.idx += 1;
    if (s.idx >= s.plan.length) {
      s.over = true;
      s.idx = s.plan.length;
      return ServiceSuccess({ done: true, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
    }
    return ServiceSuccess({ done: false, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore });
  }

  // GET /:soloId — snapshot for reconnect/poll.
  snapshot(soloId: string): ServiceResult<WsSnapshot> {
    const s = this.get(soloId);
    if (!s) return ServiceError(ERROR_CODES.SOLO_NOT_FOUND, MESSAGE_KEYS.solo.NOT_FOUND, 404);
    return ServiceSuccess({ soloId, idx: s.idx, rounds: s.config.rounds, totalScore: s.totalScore, over: s.over });
  }
}

export const wsSoloService = new WsSoloService();
