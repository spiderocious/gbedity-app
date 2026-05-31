// Centralised client config. Never read import.meta.env scattered across the app.
// Defaults target the local backend (:8090). In production these come from VITE_ vars.

function readEnv(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

export const ENV = {
  /** REST base, e.g. http://localhost:8090/api/v1 */
  API_BASE_URL: readEnv('VITE_API_BASE_URL', 'http://localhost:8090/api/v1'),
  /** Socket.IO origin, e.g. http://localhost:8090 */
  WS_URL: readEnv('VITE_WS_URL', 'http://localhost:8090'),
  APP_ENV: readEnv('VITE_APP_ENV', 'development'),
} as const;
