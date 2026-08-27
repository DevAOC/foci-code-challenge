// Vitest setup: point Prisma at the dedicated test database so tests can
// never touch foci_dev. TEST_DATABASE_URL comes from apps/api/.env.
import "dotenv/config";

const testUrl = process.env["TEST_DATABASE_URL"];
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env — see DEVELOPMENT.md.",
  );
}
process.env["DATABASE_URL"] = testUrl;
