import { ENV } from "../config/env.ts";
import { log } from "../observability/logger.ts";
import { LogEvent } from "../observability/events.ts";
import { ApiError, ApiErrorCode, type FieldErrors } from "./api-error.ts";

// Thin REST client over the backend envelope ({ data } / { error: { code, message,
// field_errors } }). Unwraps `data`, throws a coded ApiError on failure. No component ever
// calls fetch directly — these go through React Query hooks (shared/api).

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  readonly body?: unknown;
  readonly token?: string;
  readonly signal?: AbortSignal;
}

interface ErrorEnvelope {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly field_errors?: FieldErrors;
  };
}

async function request<T>(
  method: HttpMethod,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  const durationMs = (): number =>
    Math.round(
      (typeof performance !== "undefined" ? performance.now() : 0) - startedAt,
    );
  const hasBody = opts.body !== undefined;
  log.event(
    LogEvent.API_REQUEST,
    { method, path, hasBody, authed: opts.token !== undefined },
    { component: "apiClient" },
  );

  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.token !== undefined
          ? { Authorization: `Bearer ${opts.token}` }
          : {}),
      },
      ...(hasBody ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });
  } catch {
    log.event(
      LogEvent.API_ERROR,
      {
        method,
        path,
        code: ApiErrorCode.NETWORK_ERROR,
        status: 0,
        durationMs: durationMs(),
      },
      { component: "apiClient" },
    );
    throw new ApiError(
      ApiErrorCode.NETWORK_ERROR,
      "Could not reach the server.",
      0,
    );
  }

  // 204: no body to parse (hard-lessons: don't .json() a No Content response).
  if (res.status === 204) {
    log.event(
      LogEvent.API_RESPONSE,
      { method, path, status: 204, durationMs: durationMs(), data: null },
      { component: "apiClient" },
    );
    return undefined as T;
  }

  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const env = json as ErrorEnvelope;
    const code = env.error?.code ?? ApiErrorCode.INTERNAL_ERROR;
    log.event(
      LogEvent.API_ERROR,
      {
        method,
        path,
        status: res.status,
        code,
        message: env.error?.message,
        durationMs: durationMs(),
      },
      { component: "apiClient" },
    );
    throw new ApiError(
      code,
      env.error?.message ?? "Something went wrong.",
      res.status,
      env.error?.field_errors,
    );
  }

  // Log the actual unwrapped response payload (`data`), not just request metadata. Kept as a nested
  // `data` field (not spread) so arrays/primitives log cleanly instead of becoming 0/1/2… keys.
  const data = (json as { data: T }).data;
  log.event(
    LogEvent.API_RESPONSE,
    { method, path, status: res.status, durationMs: durationMs(), data },
    { component: "apiClient" },
  );
  return data;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>("GET", path, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>("DELETE", path, opts),
};
