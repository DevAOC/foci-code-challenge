# foci-code-challenge

A small todo-list application built as a code challenge. The stack is
TypeScript end to end: a Node.js API backed by PostgreSQL through Prisma, a
React front end, and a shared contracts package, organised as a pnpm monorepo.

The project is being built deliberately in thin, reviewable slices: the
database layer first, then the HTTP API (see [Endpoints](#endpoints)), then
the **web app** (in progress — see `plans/todo-web.md`).

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

## Quick start

```sh
pnpm install
pnpm db:setup                       # creates foci_dev and foci_test if missing
cp apps/api/.env.example apps/api/.env   # then replace <macos-user> with `whoami`
pnpm db:migrate                     # apply migrations to foci_dev
pnpm typecheck
pnpm test
pnpm dev                            # API on http://127.0.0.1:3000, web on http://localhost:5173
```

Full setup instructions, including installing Postgres and troubleshooting, are
in [DEVELOPMENT.md](./DEVELOPMENT.md).

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

## Where the reasoning lives

- [`docs/decisions.md`](./docs/decisions.md) — each schema and tooling
  decision, the alternative rejected, and why.

- [`plans/`](./plans/) — the phased plan for each slice and the architectural
  decisions each phase depends on.
- GitHub issues hold the PRDs: [#1 database layer](https://github.com/DevAOC/foci-code-challenge/issues/1),
  [#3 HTTP API](https://github.com/DevAOC/foci-code-challenge/issues/3).
