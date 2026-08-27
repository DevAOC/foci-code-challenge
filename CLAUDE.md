# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

A pnpm monorepo with the **database layer only**: `apps/api` owns the Prisma schema, migrations, and database tests. There is no HTTP server, no routes, and no web package yet — those are tracked in GitHub issue #3 and must not be added under a database-scoped task.

## Commands

All from the repository root. Both `typecheck` and `test` must be green before committing.

```sh
pnpm install
pnpm db:setup                 # create foci_dev / foci_test if missing (idempotent)
pnpm typecheck                # prisma generate && tsc --noEmit, every package
pnpm test                     # prisma generate && vitest run, every package
pnpm --filter @foci/api test -- src/db/todos.test.ts   # single test file
pnpm db:migrate               # prisma migrate dev against foci_dev
pnpm --filter @foci/api exec prisma migrate dev --name <name>   # new migration
```

Tests hit a real Postgres database (`foci_test`); `apps/api/src/test/global-setup.ts` applies migrations before the suite and tests truncate tables themselves. Requires `apps/api/.env` (copy from `.env.example`) and a running local Postgres 18 — see `DEVELOPMENT.md`.

There is no lint or format command yet.

## Where decisions live

- `docs/decisions.md` — schema and tooling decisions with rejected alternatives. Do not re-litigate without new information.
- `plans/<feature>.md` — phased implementation plans; each phase is one commit.
- GitHub issues #1 (database PRD) and #3 (API PRD).

## Repository layout

- `apps/api/` — Prisma schema (`prisma/schema.prisma`), migrations, `src/db/` client + tests, `src/test/` DB lifecycle helpers.
- `docs/`, `plans/` — see above.
- `.claude/skills/` and `.agents/skills/` — installed agent skills (same set in both directories, mirrored for different agent tools).
- `skills-lock.json` — lockfile for those skills, pinned by source repo, path, and content hash. Skills are installed from `mattpocock/skills` and `wshobson/agents` on GitHub; edit the lockfile via the skills installer rather than by hand.

## Installed skills

Prefer these project-installed skills when the task matches:

- `tdd` — red-green-refactor workflow for features and bug fixes.
- `code-review` — review changes since a commit/branch against repo standards and the originating spec.
- `codebase-design` / `improve-codebase-architecture` — deep-module vocabulary and refactoring opportunities.
- `nodejs-backend-patterns` and `typescript-advanced-types` — the intended stack is Node.js + TypeScript; follow these when scaffolding the backend.
- `grill-me` — stress-test a plan before implementing.
- `resolving-merge-conflicts`, `git-guardrails-claude-code` — git workflow helpers.
- `prd-to-plan` — break a PRD into tracer-bullet vertical-slice phases, written to `./plans/<feature>.md`.
- `do-work` — plan → implement → verify (`pnpm typecheck`, `pnpm test`) → commit loop for a handed-off task.

`prd-to-plan` and `do-work` are local skills (not in `skills-lock.json`); edit them directly in both skill directories.
