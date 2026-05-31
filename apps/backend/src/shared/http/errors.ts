import type { ErrorCode } from './error-codes';
import type { FieldErrors } from './service-result';

// Thrown only for unexpected control flow — NOT for expected domain failures (those use
// ServiceResult). The global error handler translates AppError into the response envelope.

export class AppError extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
