import { ENV } from '../config/env.ts';
import { authStore } from './auth-store.ts';

// Admin REST client. Same envelope as the game client; attaches the admin bearer token on
// every call and throws a coded ApiError on failure.
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorEnvelope {
  readonly error?: { readonly code?: string; readonly message?: string };
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const token = authStore.getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server.', 0);
  }

  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const env = json as ErrorEnvelope;
    throw new ApiError(env.error?.code ?? 'internal_error', env.error?.message ?? 'Something went wrong.', res.status);
  }
  return (json as { data: T }).data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
