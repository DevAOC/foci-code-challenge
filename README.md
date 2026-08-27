# foci-code-challenge

A small todo-list application built as a code challenge. The stack is
TypeScript end to end: a Node.js API backed by PostgreSQL through Prisma, a
React front end, and a shared contracts package, organised as a pnpm monorepo.

The project is being built deliberately in thin, reviewable slices: the
database layer first, then the HTTP API (see [Endpoints](#endpoints)), then
the **web app** (`plans/todo-web.md`).

## Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict), Node.js 24 |
| Package manager | pnpm workspaces |
| Database | PostgreSQL 18 (local, via Homebrew) |
| ORM / migrations | Prisma 7 with the `pg` driver adapter |
| API | Fastify 5, zod validation, shared with the UI via `@foci/contracts` |
| Web | React 19 + Vite, TanStack Query, Tailwind v4 + shadcn/ui |
| Tests | Vitest — API against a real test database; web under jsdom with MSW at the network boundary |

## Layout

```
apps/
  api/          The Fastify HTTP API plus Prisma: schema, migrations, and tests.
  web/          The React single-page app (Vite), talking to the API via /api.
packages/
  contracts/    Zod schemas and wire types shared by the API and the web app.
docs/           Design decisions and their rejected alternatives.
plans/          Phased implementation plans (tracer-bullet slices).
```

## Build and run

```sh
pnpm install
pnpm db:setup                       # creates foci_dev and foci_test if missing
cp apps/api/.env.example apps/api/.env   # then replace <macos-user> with `whoami`
pnpm db:migrate                     # apply migrations to foci_dev
pnpm typecheck
pnpm test
pnpm dev                            # API on http://127.0.0.1:3000, web on http://localhost:5173
```

`pnpm dev` starts the API (`tsx watch`, port from `PORT` in `apps/api/.env`)
and the Vite dev server together; open http://localhost:5173 for the UI. The
browser calls `/api/*`, which Vite proxies to the API, so there is no CORS or
client-side config. `pnpm --filter @foci/web build` produces a static bundle in
`apps/web/dist`, but nothing serves it yet — the app is run in dev mode only.

Full setup instructions — installing Postgres, configuring `.env`, viewing the
database, and troubleshooting — are in [DEVELOPMENT.md](./DEVELOPMENT.md). The
steps above assume macOS with Homebrew; Windows users should follow the
[Windows setup](./DEVELOPMENT.md#windows-setup) section there (WSL 2 or native
PowerShell) instead.

## Running the tests

Tests need a running local Postgres with a `foci_test` database and
`apps/api/.env` in place (see [Build and run](#build-and-run)). Then, from the
repository root:

```sh
pnpm test                                             # every package
pnpm --filter @foci/contracts test                    # schema unit tests (no database)
pnpm --filter @foci/api test                          # API: service + HTTP tests against foci_test
pnpm --filter @foci/web test                          # web: React app under jsdom with MSW
pnpm --filter @foci/api test -- src/todos/routes.test.ts   # one file
pnpm --filter @foci/api exec vitest                   # watch mode
pnpm --filter @foci/api test:coverage                 # coverage (also for @foci/web)
pnpm typecheck                                        # tsc across every package
```

The API suite applies migrations to `foci_test` before running and truncates
the table between tests, so no manual reset is needed. `pnpm typecheck` and
`pnpm test` are the pre-commit gate for this repo.

## Endpoints

JSON in, JSON out, under `/todos`. Each capability from the challenge brief maps
to one call:

| Capability | Request | Success | Errors |
|---|---|---|---|
| Add | `POST /todos` `{ title, description?, dueDate? }` | `201` + todo | `400` |
| List | `GET /todos` | `200` + `{ "todos": [ … ] }` | — |
| View | `GET /todos/:id` | `200` + todo | `400` non-UUID id, `404` |
| Update | `PATCH /todos/:id` `{ title?, description?, dueDate? }` | `200` + todo | `400`, `404` |
| Complete | `PATCH /todos/:id` `{ "isCompleted": true }` | `200` + todo | `400`, `404` |
| Incomplete | `PATCH /todos/:id` `{ "isCompleted": false }` | `200` + todo | `400`, `404` |
| Delete | `DELETE /todos/:id` | `204` | `400`, `404` |

A todo looks like:

```json
{
  "id": "0f5b0f7e-0c3e-4a1e-9c2b-2f9d7d1a3b4c",
  "title": "File taxes",
  "description": "Federal and provincial",
  "dueDate": "2026-04-30T17:00:00.000Z",
  "isCompleted": false,
  "createdAt": "2026-08-27T18:44:39.695Z",
  "updatedAt": "2026-08-27T18:44:39.695Z"
}
```

Rules: `title` is trimmed and must be 1–200 characters; `description` is at most
2000 characters and an empty string is stored as `null`; `dueDate` is an ISO
8601 date-time with an explicit offset (`2026-04-30T13:00:00-04:00`) and is
always returned normalized to UTC; on `PATCH`, `null` clears `description` or
`dueDate`; unknown fields are rejected. Every error has one shape:

```json
{ "error": { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "Request is invalid",
             "issues": [ { "path": "title", "message": "Title must not be empty" } ] } }
```

`code` is `VALIDATION_ERROR` (400), `NOT_FOUND` (404), or `INTERNAL_ERROR`
(500); `issues` appears only on validation errors.

## Data model

One table, `todos`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | generated client-side |
| `title` | `varchar(200)` NOT NULL | |
| `description` | `varchar(2000)` NULL | |
| `due_date` | `timestamptz` NULL | the instant the todo is due |
| `is_completed` | `boolean` NOT NULL, default `false` | single source of truth for completion |
| `created_at` | `timestamptz` NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` NOT NULL | maintained by Prisma `@updatedAt` |

Physical names are snake_case; the Prisma model (`Todo`) uses camelCase. The
schema is in `apps/api/prisma/schema.prisma` and every change ships as a
migration under `apps/api/prisma/migrations/`.

## Design choices

### Backend architecture

- **Monorepo with a shared contract.** `packages/contracts` holds the zod
  schemas for every request body, the `TodoResponse` wire type, and the error
  envelope. The API validates with them and the web app types its client and
  form validation with them, so the two sides cannot drift.
- **Three fixed layers in the API.** `src/todos/routes.ts` parses and
  validates the request and serializes the response; `src/todos/service.ts`
  is the only module that touches Prisma and throws domain errors
  (`NotFoundError`); `src/http/errors.ts` turns every thrown error — zod,
  domain, or unexpected — into the single `{ error: { … } }` shape. Routes
  never see Prisma and the service never sees HTTP, which keeps each layer
  small enough to test on its own.
- **Fastify + Prisma + Postgres.** Fastify for its built-in `inject()`
  testing and fast JSON handling; Prisma for typed queries and a migration
  workflow that will scale to filtering, sorting, and pagination; a real
  Postgres rather than SQLite so the schema (`timestamptz`, `uuid`) matches
  what production would run.
- **Plain REST, one resource.** Complete/incomplete are `PATCH { isCompleted }`
  rather than action endpoints; `PATCH` is a partial update where `null`
  clears an optional field; bodies are strict (unknown keys are a `400`).
- **Web app mirrors the API's layering.** One `fetch` in `src/api/client.ts`
  (throws `ApiError` from the envelope) → query/mutation definitions in
  `src/api/todos.ts` → components. TanStack Query owns server state; there is
  no global store and no router because there is one page.

### Testing strategy

- **Test at the boundaries the user cares about, never mock what we own.**
  API tests call the Fastify app in-process via `app.inject()` against a real
  `foci_test` database — no ports, no mocked Prisma — so a passing test means
  the SQL, the ORM, the validation, and the serialization all agree. Web
  tests render the whole `App` under jsdom and answer `fetch` with
  [MSW](https://mswjs.io) handlers typed against `@foci/contracts`, then
  drive it with accessible queries (roles, labels) rather than test IDs.
- **Three tiers, each isolated.** Contracts: pure schema unit tests (fast,
  no I/O). API: service tests for behaviour and route tests for HTTP
  semantics (status codes, envelope, validation issues). Web: one test file
  per user flow (list, create, edit/delete, toggle).
- **Deterministic by construction.** Test files that share the database run
  serially; the table is truncated between tests; `TZ` is pinned for the web
  suite so due-date formatting is stable. Migrations are applied by the test
  runner itself, so a fresh clone runs green with no manual steps beyond
  creating the database.

## Assumptions

- A single anonymous user. There is no authentication, no per-user data, and
  no concurrency handling beyond what the database gives us.
- The reviewer runs the app locally in dev mode on macOS (or WSL); nothing is
  deployed or containerized, and the web build is not served.
- A todo's due date is an instant, not a calendar day: it is stored as
  `timestamptz`, entered in the viewer's local zone, and returned in UTC.
- Titles are short (≤ 200 chars) and descriptions bounded (≤ 2000 chars);
  empty strings mean "not set".
- The list is small enough to return in full, in creation order, with no
  pagination, filtering, or sorting options yet.
- `GET /todos/:id` exists for API completeness but the UI does not need it.

## Where the reasoning lives

- [`docs/decisions.md`](./docs/decisions.md) — each schema and tooling
  decision, the alternative rejected, and why.

- [`plans/`](./plans/) — the phased plan for each slice and the architectural
  decisions each phase depends on.
- GitHub issues hold the PRDs: [#1 database layer](https://github.com/DevAOC/foci-code-challenge/issues/1),
  [#3 HTTP API](https://github.com/DevAOC/foci-code-challenge/issues/3).

## Trade-offs and notes from the assessment

Notes I took while building, for whoever reviews this. Most of the items
under "General decisions" are trade-offs made because of the time constraint.

### General decisions

- Used TS/Node/React because it's easiest for me to vet once the code is in (most comfortable language).
- Chose Prisma ORM for future-proofing: it makes it easier to run migrations and to add filtering, sorting, and pagination in later iterations.
- Split each feature into separate grill-me, to-prd, prd-to-plan, and implementation steps.
- Developed on a Mac, so the primary setup steps are macOS-first. There is an unverified [Windows setup](./DEVELOPMENT.md#windows-setup) section in DEVELOPMENT.md, but I couldn't test it and some helper scripts (`pnpm db:setup`) are POSIX shell only.
- No caching or rate limiting, because of the time constraint.
- Didn't containerize because it was just me working on the app; it should be added if a bigger team works on it.
- If this were a large app I would have added Playwright and written much more in-depth frontend tests. No time.
- Left the `GET /todos/:id` route unused, as I didn't see a need for it in the current state of the app.

### Todo

- `id` is a UUID in case there are many users in the future (a bigint may not be enough at scale).
- `isCompleted` could have been derived from a `completed_at` timestamp.
- Added `updatedAt` to track updates (feels standard for all records).
- `title` has an additional check that its length is greater than 0 and at most 200 characters.
- `description` has a max length of 2000 characters, just to add some sort of upper bound.
- `dueDate` was changed from a plain date to a timestamp so it was easier to handle in the UI. It was an oversight that was easy to fix since we had no data.

### User

- Left out user auth and tenancy, but noted that they would be added in the future.
