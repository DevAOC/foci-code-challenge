import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestClient, truncateAll } from "../test/db.js";
import { createApi } from "../test/http.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UNKNOWN_ID = "0f5b0f7e-0c3e-4a1e-9c2b-2f9d7d1a3b4c";
const REPRESENTATION_KEYS = [
  "id",
  "title",
  "description",
  "dueDate",
  "isCompleted",
  "createdAt",
  "updatedAt",
];

describe("/todos", () => {
  const prisma = createTestClient();
  const app = buildApp({ prisma });
  const api = createApi(app);

  beforeAll(() => app.ready());
  beforeEach(() => truncateAll(prisma));
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("POST /todos", () => {
    it("creates a todo from a title alone, applying every default", async () => {
      const res = await api.post("/todos", { title: "Buy milk" });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual([...REPRESENTATION_KEYS].sort());
      expect(res.body.id).toMatch(UUID_RE);
      expect(res.body.title).toBe("Buy milk");
      expect(res.body.description).toBeNull();
      expect(res.body.dueDate).toBeNull();
      expect(res.body.isCompleted).toBe(false);
      expect(res.body.createdAt).toMatch(ISO_RE);
      expect(res.body.updatedAt).toMatch(ISO_RE);
    });

    it("creates a todo with every field, preserving the calendar date", async () => {
      const res = await api.post("/todos", {
        title: "File taxes",
        description: "Federal and provincial",
        dueDate: "2026-04-30",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: "File taxes",
        description: "Federal and provincial",
        dueDate: "2026-04-30",
        isCompleted: false,
      });
    });

    it.each(["2024-02-29", "1999-12-31", "2026-01-01"])(
      "round-trips the date %s without timezone drift",
      async (dueDate) => {
        const res = await api.post("/todos", { title: "t", dueDate });
        expect(res.body.dueDate).toBe(dueDate);
        const fetched = await api.get(`/todos/${res.body.id}`);
        expect(fetched.body.dueDate).toBe(dueDate);
      },
    );

    it("trims the title and stores an empty description as null", async () => {
      const res = await api.post("/todos", { title: "  Walk the dog  ", description: "   " });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Walk the dog");
      expect(res.body.description).toBeNull();
      const row = await prisma.todo.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.title).toBe("Walk the dog");
      expect(row.description).toBeNull();
    });

    it("accepts a 200-character title and a 2000-character description", async () => {
      const res = await api.post("/todos", {
        title: "t".repeat(200),
        description: "d".repeat(2000),
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toHaveLength(200);
      expect(res.body.description).toHaveLength(2000);
    });

    it("persists: a todo created by one app instance is visible to a fresh one", async () => {
      const created = await api.post("/todos", { title: "Survives restart" });
      const second = buildApp({ prisma: createTestClient() });
      try {
        const res = await createApi(second).get(`/todos/${created.body.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(created.body);
      } finally {
        await second.close();
        await second.prisma.$disconnect();
      }
    });

    describe("rejections", () => {
      it.each([
        ["missing title", {}, "title"],
        ["empty title", { title: "" }, "title"],
        ["whitespace-only title", { title: "   " }, "title"],
        ["201-character title", { title: "x".repeat(201) }, "title"],
        ["non-string title", { title: 42 }, "title"],
        ["2001-character description", { title: "t", description: "x".repeat(2001) }, "description"],
        ["non-string description", { title: "t", description: ["x"] }, "description"],
        ["null description", { title: "t", description: null }, "description"],
        ["invalid date format", { title: "t", dueDate: "30/04/2026" }, "dueDate"],
        ["impossible date", { title: "t", dueDate: "2026-02-30" }, "dueDate"],
        ["null dueDate", { title: "t", dueDate: null }, "dueDate"],
        ["non-string dueDate", { title: "t", dueDate: 20260430 }, "dueDate"],
        ["isCompleted on create", { title: "t", isCompleted: true }, ""],
        ["unknown field", { title: "t", duedate: "2026-04-30" }, ""],
        ["client-supplied id", { title: "t", id: UNKNOWN_ID }, ""],
      ])("rejects %s with a field error and writes nothing", async (_name, body, path) => {
        const res = await api.post("/todos", body);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
        expect(res.body.error.issues.map((issue: { path: string }) => issue.path)).toContain(path);
        expect(await prisma.todo.count()).toBe(0);
      });

      it("rejects malformed JSON and writes nothing", async () => {
        const res = await api.postRaw("/todos", '{"title": "unterminated');
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(await prisma.todo.count()).toBe(0);
      });

      it("rejects a non-object body", async () => {
        const res = await api.postRaw("/todos", '"just a string"');
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(await prisma.todo.count()).toBe(0);
      });

      it("reports every invalid field in one response", async () => {
        const res = await api.post("/todos", { title: "", description: 1, dueDate: "nope" });
        expect(res.status).toBe(400);
        expect(res.body.error.issues.map((issue: { path: string }) => issue.path)).toEqual([
          "title",
          "description",
          "dueDate",
        ]);
      });
    });
  });

  describe("GET /todos/:id", () => {
    it("returns the todo exactly as it was returned on creation", async () => {
      const created = await api.post("/todos", {
        title: "Read",
        description: "A book",
        dueDate: "2026-05-01",
      });
      const res = await api.get(`/todos/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
      expect(res.headers["content-type"]).toMatch(/^application\/json/);
    });

    it("returns 404 NOT_FOUND for an unknown UUID", async () => {
      const res = await api.get(`/todos/${UNKNOWN_ID}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: { statusCode: 404, code: "NOT_FOUND", message: `Todo ${UNKNOWN_ID} not found` },
      });
    });

    it.each(["123", "not-a-uuid", `${UNKNOWN_ID}x`])(
      "returns 400 VALIDATION_ERROR on id for the malformed id %s",
      async (id) => {
        const res = await api.get(`/todos/${id}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
        expect(res.body.error.issues).toEqual([{ path: "id", message: expect.any(String) }]);
      },
    );

    it("does not return another todo's data", async () => {
      const a = await api.post("/todos", { title: "A" });
      const b = await api.post("/todos", { title: "B" });
      expect((await api.get(`/todos/${a.body.id}`)).body.title).toBe("A");
      expect((await api.get(`/todos/${b.body.id}`)).body.title).toBe("B");
    });
  });

  describe("GET /todos", () => {
    it("returns an empty envelope when there are no todos", async () => {
      const res = await api.get("/todos");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ todos: [] });
    });

    it("returns todos in creation order with the full representation", async () => {
      const first = await api.post("/todos", { title: "First", dueDate: "2026-01-01" });
      const second = await api.post("/todos", { title: "Second", description: "d" });
      const third = await api.post("/todos", { title: "Third" });

      const res = await api.get("/todos");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ todos: [first.body, second.body, third.body] });
      for (const todo of res.body.todos) {
        expect(Object.keys(todo).sort()).toEqual([...REPRESENTATION_KEYS].sort());
      }
    });

    it("breaks createdAt ties by id", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const ids = [
        "ffffffff-0000-4000-8000-000000000000",
        "00000000-0000-4000-8000-000000000000",
        "88888888-0000-4000-8000-000000000000",
      ];
      for (const id of ids) {
        await prisma.todo.create({ data: { id, title: id, createdAt } });
      }

      const res = await api.get("/todos");
      expect(res.body.todos.map((todo: { id: string }) => todo.id)).toEqual([...ids].sort());
    });

    it("reflects later creates and deletes", async () => {
      const a = await api.post("/todos", { title: "A" });
      expect((await api.get("/todos")).body.todos).toHaveLength(1);
      const b = await api.post("/todos", { title: "B" });
      expect((await api.get("/todos")).body.todos).toHaveLength(2);
      await api.delete(`/todos/${a.body.id}`);
      expect((await api.get("/todos")).body).toEqual({ todos: [b.body] });
    });
  });

  describe("DELETE /todos/:id", () => {
    it("removes the todo and returns 204 with no body", async () => {
      const created = await api.post("/todos", { title: "Gone soon" });

      const res = await api.delete(`/todos/${created.body.id}`);
      expect(res.status).toBe(204);
      expect(res.body).toBeUndefined();

      expect((await api.get(`/todos/${created.body.id}`)).status).toBe(404);
      expect(await prisma.todo.count()).toBe(0);
    });

    it("returns 404 on a second delete", async () => {
      const created = await api.post("/todos", { title: "Once" });
      await api.delete(`/todos/${created.body.id}`);
      const res = await api.delete(`/todos/${created.body.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns 404 NOT_FOUND for an unknown UUID", async () => {
      const res = await api.delete(`/todos/${UNKNOWN_ID}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: { statusCode: 404, code: "NOT_FOUND", message: `Todo ${UNKNOWN_ID} not found` },
      });
    });

    it.each(["123", "not-a-uuid"])("returns 400 on id for the malformed id %s", async (id) => {
      const res = await api.delete(`/todos/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error.issues).toEqual([{ path: "id", message: expect.any(String) }]);
    });

    it("leaves other todos intact", async () => {
      const keep = await api.post("/todos", { title: "Keep" });
      const drop = await api.post("/todos", { title: "Drop" });
      await api.delete(`/todos/${drop.body.id}`);
      expect((await api.get("/todos")).body).toEqual({ todos: [keep.body] });
    });
  });
});
