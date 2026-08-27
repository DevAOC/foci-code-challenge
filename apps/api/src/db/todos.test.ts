import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, truncateAll } from "../test/db.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("todos table", () => {
  const prisma = createTestClient();

  beforeAll(() => prisma.$connect());
  beforeEach(() => truncateAll(prisma));
  afterAll(() => prisma.$disconnect());

  it("applies defaults and generates fields for a title-only insert", async () => {
    const before = new Date();
    const todo = await prisma.todo.create({ data: { title: "Buy milk" } });

    expect(todo.id).toMatch(UUID_RE);
    expect(todo.title).toBe("Buy milk");
    expect(todo.description).toBeNull();
    expect(todo.dueDate).toBeNull();
    expect(todo.isCompleted).toBe(false);
    expect(todo.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(todo.updatedAt.getTime()).toBeGreaterThanOrEqual(todo.createdAt.getTime());
  });

  it("round-trips every column, preserving dueDate to the millisecond", async () => {
    const created = await prisma.todo.create({
      data: {
        title: "File taxes",
        description: "Gather receipts first",
        dueDate: new Date("2026-04-30T17:30:00.123Z"),
        isCompleted: true,
      },
    });
    const fetched = await prisma.todo.findUniqueOrThrow({ where: { id: created.id } });

    expect(fetched).toEqual(created);
    expect(fetched.title).toBe("File taxes");
    expect(fetched.description).toBe("Gather receipts first");
    expect(fetched.isCompleted).toBe(true);
    expect(fetched.dueDate?.toISOString()).toBe("2026-04-30T17:30:00.123Z");
  });

  it("advances updatedAt when a row is updated", async () => {
    const created = await prisma.todo.create({ data: { title: "Original" } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await prisma.todo.update({
      where: { id: created.id },
      data: { isCompleted: true },
    });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(updated.createdAt).toEqual(created.createdAt);
  });

  it("rejects a title longer than 200 characters at the database level", async () => {
    await expect(prisma.todo.create({ data: { title: "x".repeat(200) } })).resolves.toBeDefined();
    await expect(prisma.todo.create({ data: { title: "x".repeat(201) } })).rejects.toThrow();
  });

  it("rejects a description longer than 2000 characters at the database level", async () => {
    await expect(
      prisma.todo.create({ data: { title: "ok", description: "x".repeat(2000) } }),
    ).resolves.toBeDefined();
    await expect(
      prisma.todo.create({ data: { title: "ok", description: "x".repeat(2001) } }),
    ).rejects.toThrow();
  });

  it("uses snake_case physical names with the designed types and nullability", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null }[]
    >`SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'todos'
      ORDER BY ordinal_position`;

    expect(columns).toEqual([
      { column_name: "id", data_type: "uuid", is_nullable: "NO", character_maximum_length: null },
      { column_name: "title", data_type: "character varying", is_nullable: "NO", character_maximum_length: 200 },
      { column_name: "description", data_type: "character varying", is_nullable: "YES", character_maximum_length: 2000 },
      { column_name: "due_date", data_type: "timestamp with time zone", is_nullable: "YES", character_maximum_length: null },
      { column_name: "is_completed", data_type: "boolean", is_nullable: "NO", character_maximum_length: null },
      { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO", character_maximum_length: null },
      { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: "NO", character_maximum_length: null },
    ]);
  });
});
