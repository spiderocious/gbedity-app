import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8090),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  APP_BASE_URL: z.string().url().default('http://localhost:8090'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),

  // Persistence. Mongo today; the repo layer keeps this swappable.
  MONGO_URL: z.string().default('mongodb://127.0.0.1:27017'),
  MONGO_DB_NAME: z.string().default('gbedity'),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env: Env = parsed.data;
