// The one place the browser talks HTTP. Relative /api URLs are proxied to the
// Fastify API in development (see vite.config.ts); every failure surfaces as an
// ApiError carrying the API's error envelope, or as the raw fetch error when no
// response arrived at all.
import type { ErrorBody, ErrorCode, ErrorIssue } from "@foci/contracts";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly issues: ErrorIssue[];

  constructor(statusCode: number, code: ErrorCode, message: string, issues: ErrorIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

/** Sends `body` as JSON to `/api${path}` and returns the parsed response, or `undefined` for 204. */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { accept: "application/json" } };
  if (body !== undefined) {
    init.headers = { ...init.headers, "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  // Absolute so it works under jsdom as well as in the browser.
  const response = await fetch(new URL(`/api${path}`, document.baseURI), init);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = undefined;
  try {
    parsed = text === "" ? undefined : JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    if (isErrorBody(parsed)) {
      const { statusCode, code, message, issues } = parsed.error;
      throw new ApiError(statusCode, code, message, issues);
    }
    throw new ApiError(response.status, "INTERNAL_ERROR", `Request failed with status ${response.status}`);
  }
  return parsed as T;
}
