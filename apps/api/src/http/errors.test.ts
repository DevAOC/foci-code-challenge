import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestClient } from "../test/db.js";
import { createApi } from "../test/http.js";
import { HttpError, NotFoundError, ValidationError, issuesFromZod } from "./errors.js";
import { z } from "zod";

describe("error contract", () => {
  const prisma = createTestClient();
  const app = buildApp({ prisma });
  const api = createApi(app);

  beforeAll(async () => {
    // Throw-away routes that exercise each branch of the error handler.
    app.get("/boom", () => {
      throw new Error("secret internal detail");
    });
    app.get("/missing", () => {
      throw new NotFoundError("Todo 123 not found");
    });
    app.get("/invalid", () => {
      throw new ValidationError("Request is invalid", [{ path: "title", message: "Required" }]);
    });
    app.get("/zod", () => {
      z.object({ title: z.string() }).parse({});
    });
    app.post("/echo", (request) => request.body);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("returns a NOT_FOUND body for an unknown route", async () => {
    const res = await api.get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { statusCode: 404, code: "NOT_FOUND", message: "Route GET /nope not found" },
    });
    expect(res.body.error).not.toHaveProperty("issues");
  });

  it("returns a VALIDATION_ERROR body for malformed JSON", async () => {
    const res = await api.postRaw("/echo", "{ not json");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(typeof res.body.error.message).toBe("string");
  });

  it("returns a VALIDATION_ERROR body for an empty JSON body", async () => {
    const res = await api.postRaw("/echo", "");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("hides the internal message behind a generic 500", async () => {
    const res = await api.get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { statusCode: 500, code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(JSON.stringify(res.body)).not.toContain("secret internal detail");
  });

  it("maps a thrown NotFoundError to a 404 body", async () => {
    const res = await api.get("/missing");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { statusCode: 404, code: "NOT_FOUND", message: "Todo 123 not found" },
    });
  });

  it("maps a thrown ValidationError to a 400 body with issues", async () => {
    const res = await api.get("/invalid");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request is invalid",
        issues: [{ path: "title", message: "Required" }],
      },
    });
  });

  it("maps an uncaught zod error to a 400 body with issues", async () => {
    const res = await api.get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.issues).toEqual([{ path: "title", message: expect.any(String) }]);
  });

  it("sends every error as application/json", async () => {
    for (const url of ["/nope", "/boom", "/missing", "/invalid", "/zod"]) {
      const res = await api.get(url);
      expect(res.headers["content-type"]).toMatch(/^application\/json/);
    }
  });

  describe("helpers", () => {
    it("HttpError.toBody omits issues when there are none", () => {
      expect(new HttpError(418, "INTERNAL_ERROR", "teapot").toBody()).toEqual({
        error: { statusCode: 418, code: "INTERNAL_ERROR", message: "teapot" },
      });
    });

    it("issuesFromZod joins nested paths with dots", () => {
      const result = z.object({ a: z.object({ b: z.string() }) }).safeParse({ a: {} });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(issuesFromZod(result.error)).toEqual([{ path: "a.b", message: expect.any(String) }]);
      }
    });
  });
});
