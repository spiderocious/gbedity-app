import type { ZodError } from 'zod';

import type { FieldErrors } from './service-result';

// Flatten a ZodError into the response envelope's field_errors shape. A `prefix` namespaces the
// paths (e.g. 'config' / 'content') so the client knows which payload failed. Root-level issues
// (empty path) map to the prefix key itself.
export const zodFieldErrors = (error: ZodError, prefix: string): FieldErrors => {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? `${prefix}.${issue.path.join('.')}` : prefix;
    (out[path] ??= []).push(issue.message);
  }
  return out;
};
