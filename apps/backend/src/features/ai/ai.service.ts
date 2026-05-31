import { env } from '../../env';
import { logger } from '@lib/logger';

// AI service (PRD §8/§11) — Plead Your Case scoring only. OpenAI, ephemeral, long-text. Prompt
// shell from env, rubric from Mongo (passed in). NO validation use (Q4). With the placeholder key,
// calls fail gracefully → ok:false ("evaluation failed").

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
}

export interface ScorePleaInput {
  charge: string;
  defendant: string;
  facts: string;
  laws: string;
  precedents: string;
  argument: string;
  criteria: RubricCriterion[];
}

export interface ScorePleaResult {
  ok: boolean;
  perCriterion: { criterion: string; score: number; rationale: string }[];
  total: number; // weighted 0..100, computed in our code
  groundingOk: boolean;
}

const isPlaceholderKey = (): boolean => !env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes('REPLACE_ME');

const fillTemplate = (tpl: string, vars: Record<string, string>): string =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');

const failed: ScorePleaResult = { ok: false, perCriterion: [], total: 0, groundingOk: false };

interface RawModelOutput {
  perCriterion?: { criterion?: string; score?: number; rationale?: string }[];
  groundingOk?: boolean;
}

export class AIService {
  // Absolute score for one argument. Retries once on failure (Q5 handled by caller for the round).
  async scorePlea(input: ScorePleaInput): Promise<ScorePleaResult> {
    if (isPlaceholderKey()) return failed; // no real key → graceful "evaluation failed"

    const rubricCriteria = input.criteria.map((c) => `- ${c.key}: ${c.label}`).join('\n');
    const prompt = fillTemplate(env.PLEAD_PROMPT_TEMPLATE, {
      charge: input.charge,
      defendant: input.defendant,
      facts: input.facts,
      laws: input.laws,
      precedents: input.precedents,
      rubricCriteria,
      argument: input.argument,
    });

    const raw = await this.callOpenAI(prompt);
    if (raw === null) return failed;

    const parsed = this.parse(raw);
    if (parsed === null) return failed;

    // We own the weighted-total math (the model only scores criteria).
    let total = 0;
    let weightSum = 0;
    const perCriterion = input.criteria.map((c) => {
      const found = parsed.perCriterion?.find((p) => p.criterion === c.key);
      const score = typeof found?.score === 'number' ? Math.max(0, Math.min(100, found.score)) : 0;
      total += score * c.weight;
      weightSum += c.weight;
      return { criterion: c.key, score, rationale: typeof found?.rationale === 'string' ? found.rationale : '' };
    });

    return {
      ok: true,
      perCriterion,
      total: weightSum > 0 ? Math.round(total / weightSum) : 0,
      groundingOk: parsed.groundingOk !== false,
    };
  }

  private async callOpenAI(prompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'openai non-200');
        return null;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'openai call failed');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parse(raw: string): RawModelOutput | null {
    try {
      return JSON.parse(raw) as RawModelOutput;
    } catch {
      return null;
    }
  }
}

export const aiService = new AIService();
