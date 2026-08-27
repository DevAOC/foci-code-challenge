import type { FastifyInstance, InjectOptions } from "fastify";

export interface ApiResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body, or `undefined` when the body is empty (e.g. 204). */
  body: any;
}

/**
 * Thin wrapper over Fastify's in-process `inject` so tests read like HTTP calls
 * without opening a port. Bodies are sent as JSON unless `raw` is given.
 */
export function createApi(app: FastifyInstance) {
  async function call(
    method: NonNullable<InjectOptions["method"]>,
    url: string,
    payload?: unknown,
    raw?: string,
  ): Promise<ApiResponse> {
    const options: InjectOptions = { method, url };
    if (raw !== undefined) {
      options.payload = raw;
      options.headers = { "content-type": "application/json" };
    } else if (payload !== undefined) {
      options.payload = JSON.stringify(payload);
      options.headers = { "content-type": "application/json" };
    }
    const response = await app.inject(options);
    return {
      status: response.statusCode,
      headers: response.headers as ApiResponse["headers"],
      body: response.body === "" ? undefined : JSON.parse(response.body),
    };
  }

  return {
    get: (url: string) => call("GET", url),
    post: (url: string, body?: unknown) => call("POST", url, body),
    patch: (url: string, body?: unknown) => call("PATCH", url, body),
    delete: (url: string) => call("DELETE", url),
    /** Sends the string verbatim with a JSON content type (for malformed-body tests). */
    postRaw: (url: string, raw: string) => call("POST", url, undefined, raw),
  };
}

export type Api = ReturnType<typeof createApi>;
