import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Creates a Prisma client bound to the given Postgres connection string.
 * Callers own the client's lifecycle and must call `$disconnect()`.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Reads DATABASE_URL from the environment or throws with a helpful message. */
export function databaseUrlFromEnv(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set — see DEVELOPMENT.md.");
  }
  return url;
}
