// Runs once before the whole suite: bring foci_test up to date with the
// checked-in migrations so tests always see the current schema.
import "dotenv/config";
import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
  const testUrl = process.env["TEST_DATABASE_URL"];
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env — see DEVELOPMENT.md.",
    );
  }
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
