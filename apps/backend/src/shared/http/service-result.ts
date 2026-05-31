import type { ErrorCode } from './error-codes';
import type { MessageKey } from '../messages/keys';

// Services return ServiceResult<T> for expected outcomes — they never throw for domain failures.
// Controllers unwrap and map to ResponseUtil. Throwing is reserved for unexpected failures.

export type FieldErrors = Record<string, string[]>;

export type ServiceResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errorCode: ErrorCode;
      messageKey: MessageKey;
      httpStatus: number;
      fieldErrors?: FieldErrors;
    };

export const ServiceSuccess = <T>(data: T): ServiceResult<T> => ({ success: true, data });

export const ServiceError = (
  errorCode: ErrorCode,
  messageKey: MessageKey,
  httpStatus: number,
  fieldErrors?: FieldErrors,
): ServiceResult<never> => ({
  success: false,
  errorCode,
  messageKey,
  httpStatus,
  // exactOptionalPropertyTypes: only include the key when present.
  ...(fieldErrors !== undefined && { fieldErrors }),
});
