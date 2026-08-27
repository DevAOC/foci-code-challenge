import { describe, expect, it } from "vitest";
import { issuesFromZod } from "../http/errors.js";
import {
  createTodoSchema,
  isCalendarDate,
  todoIdParamsSchema,
  updateTodoSchema,
} from "./schemas.js";
import type { z } from "zod";

/** Returns the dotted paths of the failing fields, or [] when parsing succeeds. */
function failingPaths(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : issuesFromZod(result.error).map((issue) => issue.path);
}

describe("createTodoSchema", () => {
  describe("title", () => {
    it("is required", () => {
      expect(failingPaths(createTodoSchema, {})).toEqual(["title"]);
    });

    it("is trimmed", () => {
      expect(createTodoSchema.parse({ title: "  Buy milk  " })).toEqual({ title: "Buy milk" });
    });

    it.each(["", "   ", "\t\n"])("rejects empty or whitespace-only %j", (title) => {
      expect(failingPaths(createTodoSchema, { title })).toEqual(["title"]);
    });

    it("accepts 200 characters and rejects 201", () => {
      expect(createTodoSchema.safeParse({ title: "x".repeat(200) }).success).toBe(true);
      expect(failingPaths(createTodoSchema, { title: "x".repeat(201) })).toEqual(["title"]);
    });

    it.each([null, 42, true, {}, [[]]])("rejects non-string %j", (title) => {
      expect(failingPaths(createTodoSchema, { title })).toEqual(["title"]);
    });
  });

  describe("description", () => {
    it("is optional and absent from the output when omitted", () => {
      expect(createTodoSchema.parse({ title: "t" })).not.toHaveProperty("description");
    });

    it("accepts 2000 characters and rejects 2001", () => {
      expect(createTodoSchema.safeParse({ title: "t", description: "x".repeat(2000) }).success).toBe(
        true,
      );
      expect(failingPaths(createTodoSchema, { title: "t", description: "x".repeat(2001) })).toEqual(
        ["description"],
      );
    });

    it.each(["", "   "])("turns %j into null", (description) => {
      expect(createTodoSchema.parse({ title: "t", description })).toEqual({
        title: "t",
        description: null,
      });
    });

    it("trims surrounding whitespace", () => {
      expect(createTodoSchema.parse({ title: "t", description: "  hi  " }).description).toBe("hi");
    });

    it.each([null, 42, false, {}])("rejects non-string %j", (description) => {
      expect(failingPaths(createTodoSchema, { title: "t", description })).toEqual(["description"]);
    });
  });

  describe("dueDate", () => {
    it("is optional", () => {
      expect(createTodoSchema.parse({ title: "t" })).not.toHaveProperty("dueDate");
    });

    it.each(["2026-03-01", "2024-02-29", "2000-02-29", "1999-12-31"])("accepts %s", (dueDate) => {
      expect(createTodoSchema.parse({ title: "t", dueDate })).toEqual({ title: "t", dueDate });
    });

    it.each([
      "2023-02-29",
      "1900-02-29",
      "2026-02-30",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "2026-01-00",
      "2026-1-5",
      "03/01/2026",
      "2026-03-01T00:00:00Z",
      "20260301",
      "yesterday",
      "",
    ])("rejects %j", (dueDate) => {
      expect(failingPaths(createTodoSchema, { title: "t", dueDate })).toEqual(["dueDate"]);
    });

    it.each([null, 20260301, true, new Date("2026-03-01")])("rejects non-string %j", (dueDate) => {
      expect(failingPaths(createTodoSchema, { title: "t", dueDate })).toEqual(["dueDate"]);
    });
  });

  describe("strictness", () => {
    it.each(["isCompleted", "id", "createdAt", "updatedAt", "duedate", "Title"])(
      "rejects unknown key %s",
      (key) => {
        expect(failingPaths(createTodoSchema, { title: "t", [key]: "x" })).toEqual([""]);
      },
    );

    it("reports every failing field at once", () => {
      expect(
        failingPaths(createTodoSchema, { title: "", description: 1, dueDate: "nope" }),
      ).toEqual(["title", "description", "dueDate"]);
    });

    it.each([null, "string", 1, []])("rejects a non-object body %j", (body) => {
      expect(createTodoSchema.safeParse(body).success).toBe(false);
    });
  });
});

describe("updateTodoSchema", () => {
  it("accepts each field on its own", () => {
    expect(updateTodoSchema.parse({ title: " t " })).toEqual({ title: "t" });
    expect(updateTodoSchema.parse({ description: "d" })).toEqual({ description: "d" });
    expect(updateTodoSchema.parse({ dueDate: "2026-03-01" })).toEqual({ dueDate: "2026-03-01" });
    expect(updateTodoSchema.parse({ isCompleted: true })).toEqual({ isCompleted: true });
    expect(updateTodoSchema.parse({ isCompleted: false })).toEqual({ isCompleted: false });
  });

  it("accepts all fields together", () => {
    expect(
      updateTodoSchema.parse({ title: "t", description: "d", dueDate: "2026-03-01", isCompleted: true }),
    ).toEqual({ title: "t", description: "d", dueDate: "2026-03-01", isCompleted: true });
  });

  it("rejects an empty body with a message naming the requirement", () => {
    const result = updateTodoSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issuesFromZod(result.error)).toEqual([
        { path: "", message: expect.stringContaining("At least one of") },
      ]);
    }
  });

  it("rejects title: null and empty titles", () => {
    expect(failingPaths(updateTodoSchema, { title: null })).toEqual(["title"]);
    expect(failingPaths(updateTodoSchema, { title: "" })).toEqual(["title"]);
    expect(failingPaths(updateTodoSchema, { title: "  " })).toEqual(["title"]);
    expect(failingPaths(updateTodoSchema, { title: "x".repeat(201) })).toEqual(["title"]);
  });

  it("allows null to clear description and dueDate", () => {
    expect(updateTodoSchema.parse({ description: null })).toEqual({ description: null });
    expect(updateTodoSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });

  it("turns an empty description into null", () => {
    expect(updateTodoSchema.parse({ description: "" })).toEqual({ description: null });
  });

  it("applies the same limits as create", () => {
    expect(failingPaths(updateTodoSchema, { description: "x".repeat(2001) })).toEqual([
      "description",
    ]);
    expect(failingPaths(updateTodoSchema, { dueDate: "2026-02-30" })).toEqual(["dueDate"]);
  });

  it.each([null, "true", 1, "yes"])("rejects non-boolean isCompleted %j", (isCompleted) => {
    expect(failingPaths(updateTodoSchema, { isCompleted })).toEqual(["isCompleted"]);
  });

  it.each(["id", "createdAt", "updatedAt", "duedate", "completed"])(
    "rejects unknown key %s",
    (key) => {
      expect(failingPaths(updateTodoSchema, { title: "t", [key]: "x" })).toEqual([""]);
    },
  );
});

describe("todoIdParamsSchema", () => {
  const uuid = "0f5b0f7e-0c3e-4a1e-9c2b-2f9d7d1a3b4c";

  it("accepts a UUID", () => {
    expect(todoIdParamsSchema.parse({ id: uuid })).toEqual({ id: uuid });
  });

  it.each(["123", "not-a-uuid", `${uuid}x`, uuid.slice(0, -1), "", uuid.replace(/-/g, "")])(
    "rejects %j",
    (id) => {
      expect(failingPaths(todoIdParamsSchema, { id })).toEqual(["id"]);
    },
  );
});

describe("isCalendarDate", () => {
  it("checks the format before the calendar", () => {
    expect(isCalendarDate("2026-03-01")).toBe(true);
    expect(isCalendarDate("2026-3-1")).toBe(false);
    expect(isCalendarDate("2026-02-29")).toBe(false);
  });
});
