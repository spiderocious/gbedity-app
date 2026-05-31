import { ENV } from '../config/env.ts';
import { ApiError, ApiErrorCode, type FieldErrors } from './api-error.ts';

// Thin REST client over the backend envelope ({ data } / { error: { code, message,
// field_errors } }). Unwraps `data`, throws a coded ApiError on failure. No component ever
// calls fetch directly — these go through React Query hooks (shared/api).

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  readonly body?: unknown;
  readonly token?: string;
  readonly signal?: AbortSignal;
}

interface ErrorEnvelope {
  readonly error?: { readonly code?: string; readonly message?: string; readonly field_errors?: FieldErrors };
}

async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token !== undefined ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });
  } catch {
    throw new ApiError(ApiErrorCode.NETWORK_ERROR, 'Could not reach the server.', 0);
  }

  // 204: no body to parse (hard-lessons: don't .json() a No Content response).
  if (res.status === 204) return undefined as T;

  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const env = json as ErrorEnvelope;
    throw new ApiError(
      env.error?.code ?? ApiErrorCode.INTERNAL_ERROR,
      env.error?.message ?? 'Something went wrong.',
      res.status,
      env.error?.field_errors,
    );
  }

  return (json as { data: T }).data;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};
