# Plan: Todo database layer (Postgres + Prisma)

> Source PRD: https://github.com/DevAOC/foci-code-challenge/issues/1 (database layer). The HTTP API is deliberately excluded from this PR; it has its own PRD (https://github.com/DevAOC/foci-code-challenge/issues/3) and will get its own plan.

## Scope of this PR

Deliver a working, documented, tested PostgreSQL persistence layer for todos inside a pnpm monorepo. When this PR merges:

- a new developer can clone, create the databases, migrate, and run green tests by following the docs;
- the `todos` table exists exactly as designed and is verified by tests through the Prisma client;
- the schema decisions and rejected alternatives are recorded.

Nothing in this PR listens on a port.

## Architectural decisions

Durable decisions that apply across all phases:

- **Repository layout**: pnpm workspace monorepo. This PR creates the workspace and the API package as the home for Prisma (it contains no server code yet). The web package is not created in this PR. Root `pnpm typecheck` and `pnpm test` fan out to workspace packages.
- **Database**: PostgreSQL 18 installed locally via Homebrew (`postgresql@18`, no Docker), listening on `localhost:5432`. The developer's macOS user is a superuser with passwordless local auth, so `DATABASE_URL` is of the form `postgresql://<macos-user>@localhost:5432/<db>`. Two databases, both created by hand (none exist yet): `foci_dev` for development and `foci_test` for the test suite. Connection via `DATABASE_URL` in a gitignored `.env`; `.env.example` committed with a placeholder user. Tests migrate `foci_test` before the suite and truncate between tests. No database mocking.
- **ORM / migrations**: Prisma. Schema changes always go through Prisma migrations checked into the repo.
- **Schema** — table `todos` (snake_case in DB via `@map`, camelCase in TypeScript):

  | Column | Type | Notes |
  |---|---|---|
  | `id` | uuid PK | generated client-side by Prisma `uuid()` |
  | `title` | varchar(200) NOT NULL | non-empty-after-trim will be enforced by the future API's validation, not the DB |
  | `description` | varchar(2000) NULL | empty-string → NULL will be handled by the future API's validation |
  | `due_date` | date NULL | calendar date only |
  | `is_completed` | boolean NOT NULL DEFAULT false | sole source of truth for completion |
  | `created_at` | timestamptz NOT NULL DEFAULT now() | |
  | `updated_at` | timestamptz NOT NULL | Prisma `@updatedAt`, no trigger |

  No `user_id`, `completed_at`, `position`, indexes, or CHECK constraints.
- **Key model**: `Todo` — the only domain model. Its TypeScript type is the Prisma-generated one.
- **Testing**: Vitest. The seam is the Prisma client against the real `foci_test` database. Tests assert observable database behaviour (defaults, generated values, nullability, length limits, round-tripping of each column type), never Prisma internals. Follow the `tdd` skill (red → green → refactor) in every phase.
- **Documentation**: `README.md` is the front door (what the project is, stack, quick start, link to docs). `DEVELOPMENT.md` is the hands-on guide (prerequisites, database creation, env setup, migrate/test/typecheck commands, troubleshooting). A short decisions document records schema decisions and rejected alternatives.
- **Auth**: none. Single tenant.

---

## Phase 1: Workspace, local databases, and connectivity

**User stories**: 15, 17 (partial), 18, 19, 24, 25

### What to build

Create the pnpm workspace with a single API package that will own Prisma. Create the two local databases — `foci_dev` and `foci_test` — and write down exactly how, since this is the step a new developer will trip on. Add Prisma with an empty schema (datasource only, no models yet), `DATABASE_URL` via `.env` / `.env.example`, and a Vitest test that connects to `foci_test` through the Prisma client and runs a trivial raw query, proving the whole toolchain (workspace → Prisma → Postgres) works before any table exists.

Start `DEVELOPMENT.md` with prerequisites (Homebrew `postgresql@18`, Node 24, pnpm), how to check the server is running (`pg_isready`) and start it if not, the database creation commands (`createdb foci_dev`, `createdb foci_test`), `.env` setup, and the test / typecheck commands. Start `README.md` with the project description, the stack, and a pointer to `DEVELOPMENT.md`. A convenience script (e.g. `pnpm db:setup`) that creates both databases idempotently is welcome but must not replace the written steps.

### Acceptance criteria

- [ ] `pnpm install` at the root installs the workspace
- [ ] `pnpm typecheck` and `pnpm test` run from the root and pass
- [ ] `foci_dev` and `foci_test` exist locally, and `DEVELOPMENT.md` contains the exact commands used to create them
- [ ] `.env.example` is committed with a placeholder `DATABASE_URL`; `.env` is gitignored
- [ ] A Vitest test connects to `foci_test` via the Prisma client and succeeds
- [ ] `DEVELOPMENT.md` covers prerequisites, checking/starting Postgres, database creation, env setup, and the test / typecheck commands
- [ ] `README.md` describes the project and stack and links to `DEVELOPMENT.md`
- [ ] No HTTP server, routes, or web package exist

---

## Phase 2: The `todos` table

**User stories**: 1 (persistence only), 4, 14, 17, 20, 21, 22, 27

### What to build

Add the `Todo` model to the Prisma schema with every column, type, mapping, and default from the architectural decisions, and generate the first migration. Add the test-database lifecycle (migrate before the suite, truncate between tests). Verify the table through the Prisma client: insert a row using nothing but a title and assert every default and generated field (`id` is a UUID, `isCompleted` false, `description`/`dueDate` null, `createdAt`/`updatedAt` populated); insert a row with all fields and assert each round-trips (`dueDate` comes back as the same calendar date with no timezone drift); update a row and assert `updatedAt` advances; assert the database rejects a 201-character title and a 2001-character description. Confirm the physical table and column names are snake_case.

Update `DEVELOPMENT.md` with the migration commands (apply migrations, create a new migration, reset the dev database).

### Acceptance criteria

- [ ] Migration creates table `todos` with exactly the columns, types, nullability, and defaults in the architectural decisions (verified by inspecting the migrated database or the generated SQL)
- [ ] Physical table and column names are snake_case; Prisma model fields are camelCase
- [ ] Test: title-only insert yields correct defaults and generated `id`/`createdAt`/`updatedAt`
- [ ] Test: full insert round-trips every column; `dueDate` is preserved as a calendar date
- [ ] Test: updating a row advances `updatedAt`
- [ ] Test: 201-character title and 2001-character description are rejected by the database
- [ ] Test database is migrated before the suite and cleaned between tests so suites are order-independent
- [ ] `DEVELOPMENT.md` documents applying migrations, creating a migration, and resetting the dev database

---

## Phase 3: Documentation and decision record

**User stories**: 18, 26, 27

### What to build

Make the PR reviewable and the project onboardable. Re-verify `DEVELOPMENT.md` end to end on a clean machine state (drop both databases, follow the doc, reach green tests) and fix anything that didn't match. Add a troubleshooting section (server not running, role/permission errors, wrong `DATABASE_URL`, test database left dirty). Write the decisions document: each schema decision, the alternative rejected, and why (from PRD #1 and the design session). Fill out `README.md` with a schema overview and a link to the decisions document. Update the project instructions file (`CLAUDE.md`) with the real commands, including how to run a single test, and note that the API is future work.

### Acceptance criteria

- [ ] `DEVELOPMENT.md` walks a new developer from clone to passing tests with copy-pasteable commands, verified by actually following it after `dropdb foci_dev foci_test`
- [ ] `DEVELOPMENT.md` has a troubleshooting section for the common local-Postgres failures
- [ ] A decisions document lists each schema decision, the alternative rejected, and why
- [ ] `README.md` explains the project, stack, quick start, schema overview, and links to `DEVELOPMENT.md` and the decisions document
- [ ] `CLAUDE.md` lists the real install / typecheck / test / single-test / migrate commands and no longer claims there is no tooling

---

## Deferred to the API PRD, #3 (not in this PR)

- HTTP server, all `/todos` routes, and the API representation of a todo
- zod validation (non-empty title, empty-string-to-null, date-string format)
- HTTP-seam tests
- Web package / React UI
- PRD #1 user stories 2, 3, 5–13, 16, 23 are entirely API-level and belong to that plan
