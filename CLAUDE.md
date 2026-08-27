# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

A pnpm monorepo with three packages. `packages/contracts` (`@foci/contracts`) is the wire contract shared by the API and its clients: the zod validation schemas for `/todos`, the `TodoResponse` representation, and the `ErrorBody` envelope; it depends on zod only and is imported as source (no build). `apps/api` (`@foci/api`) is the Prisma schema, migrations, database tests, and a Fastify JSON API under `/todos` delivered per `plans/todo-api.md` (issue #3). `apps/web` (`@foci/web`) is the React single-page app delivered per `plans/todo-web.md` (issue #6): Vite, TanStack Query, Tailwind v4 + shadcn/ui (Base UI primitives), Inter, no router. One list page of cards; New / click-a-card open one `TodoForm` in a dialog; the card checkbox toggles completion optimistically. Its layering: `src/api/client.ts` (the only `fetch`; throws `ApiError` from the envelope) → `src/api/todos.ts` (query/mutation definitions) → components. The browser calls relative `/api/*` URLs that Vite proxies to the API in dev. Layering is fixed: `src/todos/routes.ts` (parse, validate with the schemas from `@foci/contracts`, delegate, serialize with `src/todos/serialize.ts`) → `src/todos/service.ts` (the only module that touches Prisma; throws `NotFoundError`) → Prisma. Validation schemas live in `@foci/contracts` and nowhere else. `src/http/errors.ts` renders every failure as `{ error: { statusCode, code, message, issues? } }`. `src/app.ts` builds the app; `src/server.ts` is the `pnpm dev` entrypoint. `dueDate` is a `timestamptz` carried as an ISO 8601 instant with offset, returned normalized to UTC.

## Commands

All from the repository root. Both `typecheck` and `test` must be green before committing.

```sh
pnpm install
pnpm db:setup                 # create foci_dev / foci_test if missing (idempotent)
pnpm dev                      # API on http://127.0.0.1:$PORT (default 3000) + web on http://localhost:5173, in parallel
pnpm typecheck                # prisma generate && tsc --noEmit, every package
pnpm test                     # prisma generate && vitest run, every package
pnpm --filter @foci/api test -- src/db/todos.test.ts   # single test file
pnpm --filter @foci/contracts test                     # schema unit tests only (no database)
pnpm --filter @foci/api test:coverage                  # coverage for app/http/todos modules
pnpm --filter @foci/web test:coverage                  # coverage for the web app
pnpm --filter @foci/web build                          # tsc -b && vite build; must pass before committing web changes
pnpm db:migrate               # prisma migrate dev against foci_dev
pnpm --filter @foci/api exec prisma migrate dev --name <name>   # new migration
```

API tests hit a real Postgres database (`foci_test`); `apps/api/src/test/global-setup.ts` applies migrations before the suite and tests truncate tables themselves. HTTP tests go through `app.inject()` via `apps/api/src/test/http.ts` — never open a port in tests, never mock Prisma. Web tests render the whole `App` under jsdom (`apps/web/src/test/render.tsx`) and answer `fetch` with MSW handlers (`apps/web/src/test/handlers.ts`, typed against `@foci/contracts`) — never mock a module the app owns, query the DOM with accessible selectors. Requires `apps/api/.env` (copy from `.env.example`) and a running local Postgres 18 — see `DEVELOPMENT.md`.

There is no lint or format command yet.

## Where decisions live

- `docs/decisions.md` — schema and tooling decisions with rejected alternatives. Do not re-litigate without new information.
- `plans/<feature>.md` — phased implementation plans; each phase is one commit.
- GitHub issues #1 (database PRD) and #3 (API PRD).

## Repository layout

- `packages/contracts/` — `src/todos.ts` (zod schemas, input types, length constants, `TodoResponse`), `src/errors.ts` (`ErrorBody`, `ErrorCode`, `ErrorIssue`), schema unit tests. No database, no Fastify.
- `apps/web/` — `src/api/` fetch client + query definitions, `src/components/` page and cards (`ui/` is shadcn-generated), `src/lib/` due-date formatting, `src/test/` MSW server/handlers and render helper, tests beside the code.
- `apps/api/` — Prisma schema (`prisma/schema.prisma`), migrations, `src/db/` client + tests, `src/http/` error handling (re-exports the error types from contracts), `src/todos/` service/routes/serializer + HTTP tests, `src/test/` DB lifecycle and inject helpers.
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
