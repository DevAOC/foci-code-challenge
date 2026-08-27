import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../http/errors.js";
import { createTestClient, truncateAll } from "../test/db.js";
import { updateTodo } from "./service.js";

// The HTTP seam covers the happy paths; these pin service behaviour that
// cannot be reached through validated requests.
describe("todos service", () => {
  const prisma = createTestClient();

  beforeAll(() => prisma.$connect());
  beforeEach(() => truncateAll(prisma));
  afterAll(() => prisma.$disconnect());

  it("translates a missing row into NotFoundError on update", async () => {
    await expect(
      updateTodo(prisma, "0f5b0f7e-0c3e-4a1e-9c2b-2f9d7d1a3b4c", { title: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not mask unrelated database errors as not-found", async () => {
    const { id } = await prisma.todo.create({ data: { title: "ok" } });
    // Bypasses zod on purpose: the 201-character title trips the varchar(200) limit.
    const attempt = updateTodo(prisma, id, { title: "x".repeat(201) });
    await expect(attempt).rejects.toThrow();
    await expect(attempt).rejects.not.toBeInstanceOf(NotFoundError);
  });
});
