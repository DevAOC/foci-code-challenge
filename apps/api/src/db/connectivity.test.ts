import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, databaseUrlFromEnv } from "./client.js";

describe("database connectivity", () => {
  const prisma = createPrismaClient(databaseUrlFromEnv());

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it("reaches the foci_test database through the Prisma client", async () => {
    const rows = await prisma.$queryRaw<
      { database: string; ok: number }[]
    >`SELECT current_database() AS database, 1 AS ok`;

    expect(rows).toEqual([{ database: "foci_test", ok: 1 }]);
  });
});
