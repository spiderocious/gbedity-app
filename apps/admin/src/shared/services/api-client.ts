import { ENV } from '../config/env.ts';
import { authStore } from './auth-store.ts';

// Admin REST client. Same envelope as the game client; attaches the admin bearer token on
// every call and throws a coded ApiError on failure.
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  // Per-field validation messages from a 422 (flattened: field → first message), if any.
  readonly fieldErrors?: Record<string, string>;
  constructor(code: string, message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    if (fieldErrors !== undefined) this.fieldErrors = fieldErrors;
  }
}

interface ErrorEnvelope {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly field_errors?: Record<string, string[] | string>;
  };
}

// Flatten the backend's `field_errors` ({ field: string[] }) to { field: firstMessage }.
function flattenFieldErrors(raw: Record<string, string[] | string> | undefined): Record<string, string> | undefined {
  if (raw === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [field, msgs] of Object.entries(raw)) {
    const first = Array.isArray(msgs) ? msgs[0] : msgs;
    if (typeof first === 'string') out[field] = first;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// The cursor-pagination meta the backend attaches to list responses (snake_case at the seam).
interface PageMeta {
  readonly next_cursor?: string | null;
  readonly has_more?: boolean;
}

// A page of list data, normalised to camelCase for the UI. `nextCursor === null` / `hasMore === false`
// means there are no further pages.
export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

async function rawRequest(method: HttpMethod, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
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

  if (res.status === 204) return { status: 204, json: undefined };
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const env = json as ErrorEnvelope;
    throw new ApiError(
      env.error?.code ?? 'internal_error',
      env.error?.message ?? 'Something went wrong.',
      res.status,
      flattenFieldErrors(env.error?.field_errors),
    );
  }
  return { status: res.status, json };
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const { status, json } = await rawRequest(method, path, body);
  if (status === 204) return undefined as T;
  return (json as { data: T }).data;
}

// A list request that preserves the pagination meta the envelope-unwrapping `request` drops.
async function requestPage<T>(path: string): Promise<Page<T>> {
  const { json } = await rawRequest('GET', path);
  const env = (json ?? {}) as { data?: readonly T[]; meta?: PageMeta };
  return {
    data: env.data ?? [],
    nextCursor: env.meta?.next_cursor ?? null,
    hasMore: env.meta?.has_more ?? false,
  };
}

// Build a query string from defined params only (cursor/limit/filters), with the leading `?`.
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs === '' ? '' : `?${qs}`;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  getPage: <T>(path: string) => requestPage<T>(path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
