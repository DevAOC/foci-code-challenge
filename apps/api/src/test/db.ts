import { createPrismaClient, databaseUrlFromEnv } from "../db/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Shared test-database helpers. `setup.ts` has already pointed DATABASE_URL at
 * foci_test, and `global-setup.ts` has already applied migrations to it.
 */
export function createTestClient(): PrismaClient {
  return createPrismaClient(databaseUrlFromEnv());
}

/** Empties every application table so each test starts from a clean slate. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "todos" RESTART IDENTITY CASCADE');
}
