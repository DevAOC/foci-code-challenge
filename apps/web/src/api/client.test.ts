import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { errorBody } from "../test/handlers.js";
import { server } from "../test/server.js";
import { ApiError, request } from "./client.js";

describe("request", () => {
  it("returns the parsed JSON body on 2xx", async () => {
    server.use(http.get("/api/ping", () => HttpResponse.json({ ok: true })));
    await expect(request("GET", "/ping")).resolves.toEqual({ ok: true });
  });

  it("sends a JSON body with the content-type header", async () => {
    let received: unknown;
    let contentType: string | null = null;
    server.use(
      http.post("/api/echo", async ({ request: req }) => {
        contentType = req.headers.get("content-type");
        const body = (await req.json()) as Record<string, unknown>;
        received = body;
        return HttpResponse.json(body, { status: 201 });
      }),
    );
    await expect(request("POST", "/echo", { title: "t" })).resolves.toEqual({ title: "t" });
    expect(received).toEqual({ title: "t" });
    expect(contentType).toBe("application/json");
  });

  it("resolves to undefined on 204", async () => {
    server.use(http.delete("/api/gone", () => new HttpResponse(null, { status: 204 })));
    await expect(request("DELETE", "/gone")).resolves.toBeUndefined();
  });

  it("turns the error envelope into an ApiError with issues", async () => {
    server.use(
      http.post("/api/todos", () =>
        HttpResponse.json(
          errorBody(400, "VALIDATION_ERROR", "Request is invalid", [
            { path: "title", message: "Title must not be empty" },
          ]),
          { status: 400 },
        ),
      ),
    );
    const error = await request("POST", "/todos", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.statusCode).toBe(400);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.message).toBe("Request is invalid");
    expect(apiError.issues).toEqual([{ path: "title", message: "Title must not be empty" }]);
  });

  it("wraps a non-envelope failure in a generic ApiError", async () => {
    server.use(http.get("/api/html", () => new HttpResponse("<h1>nope</h1>", { status: 502 })));
    const error = await request("GET", "/html").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(502);
    expect((error as ApiError).issues).toEqual([]);
  });

  it("rejects with the raw fetch error when the network fails", async () => {
    server.use(http.get("/api/down", () => HttpResponse.error()));
    const error = await request("GET", "/down").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
