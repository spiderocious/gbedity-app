import { z } from 'zod';

// Default Plead Your Case prompt shells (game-engine.md §0: prompt=env, rubric=Mongo). The AI
// service interpolates {{...}} with scenario + rubric + argument at call time and parses JSON back.
// Overridable via PLEAD_PROMPT_TEMPLATE / PLEAD_PROMPT_TEMPLATE_COMPARE in the environment.
const DEFAULT_PLEAD_PROMPT_TEMPLATE = [
  'You are an impartial legal evaluator for a party game called "Plead Your Case". You score a',
  "player's written legal defence STRICTLY against the supplied case material and rubric. You never",
  'invent facts, laws, or precedents that are not provided. If the argument relies on invented or',
  'outside facts, lower the relevant score and set "groundingOk" false.',
  '',
  'CASE',
  'Charge: {{charge}}',
  'Defendant: {{defendant}}',
  'Facts: {{facts}}',
  'Applicable laws: {{laws}}',
  'Relevant precedents: {{precedents}}',
  '',
  'RUBRIC (score each criterion 0-100):',
  '{{rubricCriteria}}',
  '',
  'PLAYER ARGUMENT',
  '{{argument}}',
  '',
  'Return ONLY valid JSON, no prose, in exactly this shape:',
  '{"perCriterion":[{"criterion":"<key>","score":<0-100>,"rationale":"<one sentence>"}],"groundingOk":<true|false>}',
  'Score only on the supplied material. Be consistent and fair. Rationales must be one sentence each.',
].join('\n');

const DEFAULT_PLEAD_PROMPT_TEMPLATE_COMPARE = [
  'You are ranking {{n}} legal defences for the SAME case (below) from strongest to weakest',
  'exoneration. Use only the supplied case material. Return ONLY JSON: {"ranking":["<argId>", ...]}',
  '(best first).',
  'CASE: {{caseBlock}}',
  'DEFENCES:',
  '{{defences}}',
].join('\n');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8090),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  APP_BASE_URL: z.string().url().default('http://localhost:8090'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),

  // Persistence. Mongo today; the repo layer keeps this swappable.
  MONGO_URL: z.string().default('mongodb://127.0.0.1:27017'),
  MONGO_DB_NAME: z.string().default('gbedity'),

  // Hot room state + pub/sub for fanout (game-engine.md §6, PRD §11/§12).
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  // AI (Plead Your Case only): prompt shell in env; rubric in Mongo (game-engine.md §0).
  // OPENAI_API_KEY ships with a placeholder default; with the placeholder, AI calls degrade to
  // "evaluation failed" gracefully. Drop the real key to light it up.
  OPENAI_API_KEY: z.string().default('sk-REPLACE_ME_placeholder'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(20000),
  PLEAD_PROMPT_TEMPLATE: z.string().default(DEFAULT_PLEAD_PROMPT_TEMPLATE),
  PLEAD_PROMPT_TEMPLATE_COMPARE: z.string().default(DEFAULT_PLEAD_PROMPT_TEMPLATE_COMPARE),

  // Admin seeding (one-shot, idempotent). Endpoint disabled unless this is 'true'.
  CAN_SEED_ADMIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Auth (admin + host JWTs). Defaults are dev-only; production must override.
  JWT_SECRET: z.string().min(16).default('dev-only-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-only-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env: Env = parsed.data;
