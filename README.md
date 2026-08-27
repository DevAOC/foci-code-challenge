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

## Where the reasoning lives

- [`plans/`](./plans/) — the phased plan for each slice and the architectural
  decisions each phase depends on.
- GitHub issues hold the PRDs: [#1 database layer](https://github.com/DevAOC/foci-code-challenge/issues/1),
  [#3 HTTP API](https://github.com/DevAOC/foci-code-challenge/issues/3).
