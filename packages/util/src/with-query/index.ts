// Append query params to a path, encoding correctly and merging with any params already on it.
// Works on relative app paths (e.g. "/join") — no origin needed. Skips null/undefined values
// and stringifies the rest. Booleans/numbers become their string form.
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export function withQuery(path: string, params?: QueryParams): string {
  if (params === undefined) return path;

  const [base, existing = ''] = path.split('?');
  const search = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query === '' ? (base ?? path) : `${base}?${query}`;
}
