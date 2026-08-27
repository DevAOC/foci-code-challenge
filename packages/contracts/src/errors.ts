/** Machine-readable discriminator carried in every error body. */
export type ErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

/** One field-level problem inside a validation error. `path` is dotted ("id", "dueDate"). */
export interface ErrorIssue {
  path: string;
  message: string;
}

/**
 * The single error body shape returned by every non-2xx response.
 * `statusCode` is duplicated from the HTTP status so a serialized body is self-describing.
 * `issues` is only present on validation errors.
 */
export interface ErrorBody {
  error: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    issues?: ErrorIssue[];
  };
}
