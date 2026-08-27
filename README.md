# foci-code-challenge

A small todo-list application built as a code challenge. The stack is
TypeScript end to end: a Node.js API backed by PostgreSQL through Prisma, and
(later) a React front end, organised as a pnpm monorepo.

The project is being built deliberately in thin, reviewable slices. The current
slice is the **database layer only** — there is no HTTP server yet.

## Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict), Node.js 24 |
| Package manager | pnpm workspaces |
| Database | PostgreSQL 18 (local, via Homebrew) |
| ORM / migrations | Prisma 7 with the `pg` driver adapter |
| Tests | Vitest, run against a real test database |

## Layout

```
apps/
  api/          Home of Prisma, the schema, migrations and database tests.
                Will also host the HTTP API in a later slice.
plans/          Phased implementation plans (tracer-bullet slices).
```

## Quick start

```sh
pnpm install
pnpm db:setup                       # creates foci_dev and foci_test if missing
cp apps/api/.env.example apps/api/.env   # then replace <macos-user> with `whoami`
pnpm typecheck
pnpm test
```

Full setup instructions, including installing Postgres and troubleshooting, are
in [DEVELOPMENT.md](./DEVELOPMENT.md).

## Data model

One table, `todos`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | generated client-side |
| `title` | `varchar(200)` NOT NULL | |
| `description` | `varchar(2000)` NULL | |
| `due_date` | `date` NULL | calendar date, no time of day |
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
