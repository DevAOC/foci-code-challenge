// Entrypoint for `pnpm dev`: wires the environment, the database, and the app together.
import "dotenv/config";
import { buildApp } from "./app.js";
import { createPrismaClient, databaseUrlFromEnv } from "./db/client.js";

const port = Number(process.env["PORT"] ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, got "${process.env["PORT"]}"`);
}

const prisma = createPrismaClient(databaseUrlFromEnv());
const app = buildApp({ prisma, logger: true });

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));

await app.listen({ port, host: "127.0.0.1" });
