import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

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

/** Base class for errors that map directly to an HTTP response. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: ErrorIssue[],
  ) {
    super(message);
    this.name = new.target.name;
  }

  toBody(): ErrorBody {
    const error: ErrorBody["error"] = {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
    };
    if (this.issues) {
      error.issues = this.issues;
    }
    return { error };
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, issues: ErrorIssue[]) {
    super(400, "VALIDATION_ERROR", message, issues);
  }
}

/** Converts a zod failure into the `issues` array used in validation error bodies. */
export function issuesFromZod(error: ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === "object" && error !== null && "code" in error && "statusCode" in error;
}

function send(reply: FastifyReply, error: HttpError): FastifyReply {
  return reply.status(error.statusCode).send(error.toBody());
}

/**
 * Registers the handlers that turn every failure into the uniform error body:
 * typed HttpErrors, zod errors, Fastify's own 4xx (malformed JSON, bad content
 * type), unknown routes, and unexpected throws (logged, never exposed).
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return send(reply, new NotFoundError(`Route ${request.method} ${request.url} not found`));
  });

  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof HttpError) {
      return send(reply, error);
    }
    if (error instanceof ZodError) {
      return send(reply, new ValidationError("Request is invalid", issuesFromZod(error)));
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      // Fastify raised this before the handler ran (e.g. FST_ERR_CTP_INVALID_JSON).
      return send(reply, new ValidationError(error.message, []));
    }
    request.log.error({ err: error }, "Unhandled error");
    return send(reply, new HttpError(500, "INTERNAL_ERROR", "Internal server error"));
  });
}
