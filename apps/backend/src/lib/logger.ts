import { env } from '../env';

// Minimal console-backed logger. Swap for pino/winston as the backend grows.
// `no-console` is allowed for warn/error by the shared ESLint config; info routes
// through console.warn intentionally so the lint rule stays satisfied in this template.
type LogFields = Record<string, unknown>;

const emit = (level: string, fields: LogFields, msg: string): void => {
  if (level === 'error') {
    console.error(JSON.stringify({ level, msg, ...fields }));
  } else {
    console.warn(JSON.stringify({ level, msg, ...fields }));
  }
};

export const logger = {
  info: (fields: LogFields, msg: string): void => {
    if (env.LOG_LEVEL === 'error' || env.LOG_LEVEL === 'warn') return;
    emit('info', fields, msg);
  },
  warn: (fields: LogFields, msg: string): void => emit('warn', fields, msg),
  error: (fields: LogFields, msg: string): void => emit('error', fields, msg),
};
