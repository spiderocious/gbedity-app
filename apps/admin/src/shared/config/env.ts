function readEnv(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

export const ENV = {
  API_BASE_URL: readEnv('VITE_API_BASE_URL', 'http://localhost:8090/api/v1'),
} as const;
