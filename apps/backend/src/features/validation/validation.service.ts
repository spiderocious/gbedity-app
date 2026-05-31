import { getDb } from '@db/client';

import { ContentCollection } from '../content/content.constants';
import { DEFAULT_FAR_OFF, FAR_OFFS } from './far-offs';
import { similarity, soundex } from './similarity';

// Multi-level word validation, faithful to wordmaster's validateWordV2 (Q3). NO LLM anywhere (Q4).
// Levels (graded): 0 letter-gate · 1 exact category+letter hit · 2 right word/wrong category
// (farOffs deduction) · 3 real word, uncategorized · 4 fuzzy near-miss suggestion.

export const DupHandling = {
  STRICT: 'strict',
  RELAXED: 'relaxed',
  SYNONYM: 'synonym',
} as const;
export type DupHandling = (typeof DupHandling)[keyof typeof DupHandling];

export interface ValidateWordInput {
  word: string;
  category?: string; // must fit this category (Wordshot / Word Bomb)
  startsWith?: string; // Wordshot letter gate; omitted by Word Bomb
  dupHandling: DupHandling;
  used?: string[]; // no-repeat set (Word Bomb)
}

export interface ValidationResult {
  valid: boolean;
  level: number; // 0 = no match
  isRealWord: boolean;
  fitsCategory: boolean;
  correctLetter: boolean;
  isDuplicate: boolean;
  confidence: number;
  score: number; // graded 0..100
  suggestion?: string;
}

const STARTING_SCORE = 100;
const STEP_DOWN = 10;

interface WordDoc {
  word: string;
  category: string;
  startsWith: string;
  aliases?: string[];
}

const startsWith = (word: string, prefix: string): boolean =>
  word.toLowerCase().startsWith(prefix.toLowerCase());

export class ValidationService {
  async validateWord(input: ValidateWordInput): Promise<ValidationResult> {
    const word = input.word.trim().toLowerCase();
    const result: ValidationResult = {
      valid: false,
      level: 0,
      isRealWord: false,
      fitsCategory: false,
      correctLetter: false,
      isDuplicate: false,
      confidence: 0,
      score: 0,
    };

    if (word.length === 0) return result;

    // Duplicate check (Word Bomb no-repeat). Synonym-tolerant collapses Soundex-equal answers.
    if (input.used && input.used.length > 0) {
      const dup = this.isDuplicate(word, input.used, input.dupHandling);
      if (dup) {
        result.isDuplicate = true;
        return result; // a repeat scores nothing regardless of validity
      }
    }

    // Level 0 — letter gate (Wordshot). Word Bomb passes no startsWith → skip.
    if (input.startsWith !== undefined && !startsWith(word, input.startsWith)) {
      return result;
    }
    result.correctLetter = input.startsWith === undefined || startsWith(word, input.startsWith);

    const words = getDb().collection<WordDoc>(ContentCollection.WORDS);

    // Level 1 — exact category + letter hit (hard validation).
    const l1 = await words.findOne({
      word,
      ...(input.category !== undefined && { category: input.category }),
      ...(input.startsWith !== undefined && { startsWith: input.startsWith.toLowerCase() }),
    });
    if (l1) {
      result.valid = true;
      result.level = 1;
      result.fitsCategory = true;
      result.isRealWord = true;
      result.confidence = 1;
      result.score = STARTING_SCORE;
      return result;
    }

    // The word exists somewhere in the categorized DB?
    const anyCat = await words.findOne({ word });
    if (anyCat) {
      result.isRealWord = true;
      // Level 2 — right word, wrong category: graded by farOffs distance.
      if (input.category !== undefined && anyCat.category !== input.category) {
        const distance = FAR_OFFS[input.category]?.[anyCat.category] ?? DEFAULT_FAR_OFF;
        const deduction = (distance / 10) * STARTING_SCORE; // 10 = full deduction
        result.level = 2;
        result.fitsCategory = false;
        result.confidence = Math.max(0, 1 - distance / 10);
        result.score = Math.max(0, Math.round(STARTING_SCORE - deduction));
        result.valid = result.score > 0;
        return result;
      }
      // category not constrained → a categorized word counts
      result.valid = true;
      result.level = 1;
      result.fitsCategory = true;
      result.confidence = 1;
      result.score = STARTING_SCORE;
      return result;
    }

    // Level 3 — real word but not categorized (dictionary only).
    const dict = await getDb().collection(ContentCollection.ALLWORDS).findOne({ word });
    if (dict) {
      result.isRealWord = true;
      result.level = 3;
      result.score = Math.max(0, STARTING_SCORE - STEP_DOWN * 3);
      // valid only if no category was required
      result.valid = input.category === undefined;
      if (result.valid) result.score = STARTING_SCORE;
      return result;
    }

    // Level 4 — fuzzy near-miss: suggest the closest real word in the (category) for feedback.
    const suggestion = await this.closestWord(word, input.category, input.startsWith);
    if (suggestion) {
      result.level = 4;
      result.suggestion = suggestion;
    }
    return result;
  }

  private isDuplicate(word: string, used: string[], dupHandling: DupHandling): boolean {
    const normalized = used.map((u) => u.toLowerCase());
    if (normalized.includes(word)) return true;
    if (dupHandling === DupHandling.SYNONYM) {
      const sx = soundex(word);
      return normalized.some((u) => soundex(u) === sx || similarity(word, u) > 0.9);
    }
    return false;
  }

  // Synonym/antonym validation (Synonyms/Antonyms games) — dataset lookup ONLY, no LLM (Q4).
  // Valid iff `guess` is in the prompt word's curated relation list (synonym-tolerant: also accept
  // a near-spelling of a listed term).
  async validateRelation(input: {
    promptWord: string;
    guess: string;
    relation: 'synonyms' | 'antonyms';
    used?: string[];
  }): Promise<{ valid: boolean; isDuplicate: boolean }> {
    const guess = input.guess.trim().toLowerCase();
    if (guess.length === 0) return { valid: false, isDuplicate: false };
    if (input.used?.some((u) => u.toLowerCase() === guess)) return { valid: false, isDuplicate: true };

    const doc = await getDb()
      .collection(ContentCollection.THESAURUS)
      .findOne({ word: input.promptWord.trim().toLowerCase() }, { projection: { _id: 0, synonyms: 1, antonyms: 1 } });
    const list = ((doc?.[input.relation] as string[] | undefined) ?? []).map((w) => w.toLowerCase());
    if (list.includes(guess)) return { valid: true, isDuplicate: false };
    // synonym-tolerant: accept a close spelling of any listed term
    const close = list.some((w) => similarity(guess, w) > 0.9);
    return { valid: close, isDuplicate: false };
  }

  // Definition Race: is `guess` the defined word? Exact, then fuzzy for "almost" feedback.
  async validateDefinitionAnswer(input: { answerWord: string; guess: string }): Promise<{ correct: boolean; closeness: number }> {
    const answer = input.answerWord.trim().toLowerCase();
    const guess = input.guess.trim().toLowerCase();
    if (guess === answer) return { correct: true, closeness: 1 };
    return { correct: false, closeness: similarity(guess, answer) };
  }

  // Closest real word for "did you mean…" — pulls candidates by prefix+category, ranks by similarity.
  private async closestWord(word: string, category?: string, startsWithLetter?: string): Promise<string | undefined> {
    const prefix = (startsWithLetter ?? word.charAt(0)).toLowerCase();
    const candidates = await getDb()
      .collection<WordDoc>(ContentCollection.WORDS)
      .find({ startsWith: prefix, ...(category !== undefined && { category }) }, { projection: { _id: 0, word: 1 } })
      .limit(200)
      .toArray();
    let best: { word: string; score: number } | undefined;
    for (const c of candidates) {
      const s = similarity(word, c.word);
      if (s > 0.6 && (!best || s > best.score)) best = { word: c.word, score: s };
    }
    return best?.word;
  }
}

export const validationService = new ValidationService();
