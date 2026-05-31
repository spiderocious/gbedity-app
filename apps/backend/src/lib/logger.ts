import { env } from '../env';

import { getContext } from '../shared/http/request-context';

// Structured JSON logger with light PII redaction. Console-backed for the template; swap for
// pino/winston as the backend grows. `no-console` in the shared config permits warn/error;
// info is routed through console.warn intentionally so the lint rule stays satisfied.

type LogFields = Record<string, unknown>;

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 } as const;

// Field names whose values are replaced with [REDACTED] (shallow — these are the PII we carry).
const REDACT_KEYS = new Set(['password', 'pin', 'otp', 'email', 'phone', 'authorization']);

const redact = (fields: LogFields): LogFields => {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
};

const emit = (level: keyof typeof LEVELS, fields: LogFields, msg: string): void => {
  if (LEVELS[level] < LEVELS[env.LOG_LEVEL]) return;
  const requestId = getContext()?.requestId;
  const line = JSON.stringify({
    level,
    msg,
    ...(requestId !== undefined && { requestId }),
    ...redact(fields),
  });
  if (level === 'error') console.error(line);
  else console.warn(line);
};

export const logger = {
  trace: (fields: LogFields, msg: string): void => emit('trace', fields, msg),
  debug: (fields: LogFields, msg: string): void => emit('debug', fields, msg),
  info: (fields: LogFields, msg: string): void => emit('info', fields, msg),
  warn: (fields: LogFields, msg: string): void => emit('warn', fields, msg),
  error: (fields: LogFields, msg: string): void => emit('error', fields, msg),
};
