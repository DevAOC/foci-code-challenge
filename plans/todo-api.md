# Plan: Todo HTTP API (Fastify + zod on the `todos` table)

> Source PRD: https://github.com/DevAOC/foci-code-challenge/issues/3 (revised 2026-08-27). Builds on the database layer from PRD #1 / `plans/todo-persistence.md`.

## Scope

Deliver a thin JSON REST API over the existing `todos` table, shipped as **two PRs**:

- **PR 1 — phases 1–3**: server scaffold, error contract, validation schemas, and the first tracer bullet (`POST /todos` + `GET /todos/:id`), plus docs.
- **PR 2 — phases 4–6**: `GET /todos`, `DELETE /todos/:id`, `PATCH /todos/:id`, and a coverage sweep.

Each phase is one commit, built red → green → refactor with the `tdd` skill. `pnpm typecheck` and `pnpm test` are green at every commit. Tests are a first-class deliverable: every phase lists the named test cases it must add.

## Architectural decisions

Durable decisions that apply across all phases (rationale and rejected alternatives are recorded in `docs/decisions.md` during phase 3):

- **Framework**: Fastify on Node 24 + TypeScript (ESM). Routes only parse, validate, delegate, and serialize.
- **Routes** (JSON in and out):

  | Foci brief capability | Route | Success | Failure |
  |---|---|---|---|
  | Add | `POST /todos` | 201 + todo | 400 |
  | List | `GET /todos` | 200 + `{ "todos": [ … ] }` | — |
  | View | `GET /todos/:id` | 200 + todo | 400 (non-UUID id), 404 |
  | Update | `PATCH /todos/:id` | 200 + todo | 400, 404 |
  | Complete | `PATCH /todos/:id` with `{ "isCompleted": true }` | 200 + todo | 400, 404 |
  | Incomplete | `PATCH /todos/:id` with `{ "isCompleted": false }` | 200 + todo | 400, 404 |
  | Delete | `DELETE /todos/:id` | 204 | 400, 404 |

  No `/complete` / `/incomplete` action routes. `GET /todos` is ordered by `createdAt` ascending, then `id` ascending, and returns the full representation for each item inside the `todos` envelope.
- **Todo representation**: `id`, `title`, `description` (string | null), `dueDate` (`YYYY-MM-DD` | null), `isCompleted`, `createdAt`, `updatedAt` (ISO 8601). Identical shape on every endpoint.
- **Error body**, for every non-2xx response including Fastify's own unknown-route 404 and malformed-JSON 400:

  ```json
  { "error": { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "…", "issues": [ { "path": "title", "message": "…" } ] } }
  ```

  `code` ∈ `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500). `issues` only on validation errors; `path` is the dotted field path (`"id"` for a malformed route param). 500s never expose the underlying message.
- **Validation**: zod, strict objects (unknown fields → 400). Title trimmed, 1–200, `null` rejected. Description ≤ 2000, `""` → `null`, `null` clears on update. Due date `YYYY-MM-DD` and a real calendar date, `null` clears on update. `isCompleted` boolean. `PATCH {}` → 400. Length limits duplicated from the Prisma schema with cross-referencing comments. Schemas live in the API package and stay Prisma-free.
- **Layering**: routes → one `todos` module (create / list / getById / update / remove over a `PrismaClient`, translating Prisma record-not-found into a typed `NotFoundError`) → Prisma. No repository/service split. Wire serialization (Date → `YYYY-MM-DD`, timestamps → ISO) lives in one place. Error helpers: base HTTP error with `statusCode` + `code`, `NotFoundError`, `ValidationError`, and one Fastify error handler.
- **Runtime**: an app factory takes a Prisma client and returns a non-listening Fastify instance. The entrypoint loads `.env`, builds the client, listens on `PORT` (default 3000) on `127.0.0.1`, and on SIGINT/SIGTERM closes the app then disconnects Prisma. `pnpm dev` = tsx watch, exposed at the root too. Logger on in dev, silent in tests. No `build`/`start`.
- **Testing**: Vitest against the real `foci_test` database, reusing the existing lifecycle (migrate in global setup, truncate before each test, `fileParallelism: false`). Primary seam is HTTP via Fastify `inject` through a small helper (`api.post(path, body)` → `{ status, body }`); one client + one app per test file. Secondary seam is the zod schemas, unit-tested. No mocking.
- **Auth / tenancy**: none, single tenant (unchanged from #1).

---

## Phase 1: Server scaffold and error contract

**User stories**: 16, 21, 26, 27

### What to build

Add Fastify and the app factory, an entrypoint runnable with `pnpm dev` (root and package), `PORT` in `.env.example`, and graceful shutdown. Register the error handler that turns every failure — typed HTTP errors, zod errors, malformed JSON, unknown routes, and unexpected throws — into the uniform error body. Add the `inject` test helper. No `/todos` routes yet: the slice is verifiable purely through the error contract.

### Acceptance criteria

- [ ] `pnpm dev` (root) starts the API on `PORT` (default 3000) and stops cleanly on Ctrl-C, disconnecting Prisma
- [ ] The app factory accepts a Prisma client and returns a Fastify instance without listening
- [ ] `PORT` documented in `.env.example`
- [ ] Test: `GET /nope` → 404 with `{ error: { statusCode: 404, code: "NOT_FOUND", message } }` and no `issues`
- [ ] Test: `POST` with a malformed JSON body → 400 with `code: "VALIDATION_ERROR"`
- [ ] Test: a route that throws an unexpected error → 500 with `code: "INTERNAL_ERROR"` and a generic message that does not contain the thrown message
- [ ] Test: a thrown `NotFoundError` → 404 body; a thrown `ValidationError` with issues → 400 body including `issues`
- [ ] Test: every error response has `content-type: application/json`
- [ ] Logger is silent under Vitest

---

## Phase 2: Validation schemas

**User stories**: 11, 12, 13, 18, 20, 24

### What to build

The zod schemas for create, update, and the `:id` route param, with the field rules from the architectural decisions, plus a helper that converts a zod failure into the `issues` array. Unit-test every boundary directly; no HTTP involved.

### Acceptance criteria

- [ ] Create schema: title required; trimmed; `""` and `"   "` rejected; 200 chars accepted, 201 rejected; non-string rejected
- [ ] Create schema: description optional; 2000 accepted, 2001 rejected; `""` → `null`; whitespace-only → trimmed then `null`; non-string rejected
- [ ] Create schema: `dueDate` optional; `2026-03-01` accepted; `2024-02-29` accepted; `2023-02-29`, `2026-02-30`, `2026-13-01`, `2026-1-5`, `03/01/2026`, `2026-03-01T00:00:00Z`, and non-string values rejected
- [ ] Create schema: `isCompleted`, `id`, `createdAt`, and unknown keys such as `duedate` rejected (strict)
- [ ] Update schema: every field optional; `title: null` rejected; `description: null` and `dueDate: null` accepted; `isCompleted` must be boolean; `{}` rejected with a message naming the requirement; unknown keys rejected
- [ ] Id param schema: a UUID accepted; `123`, `not-a-uuid`, and a UUID with a trailing character rejected
- [ ] The issues helper maps a zod error to `[{ path, message }]` with dotted paths
- [ ] Each length limit carries a comment pointing at the Prisma schema, and vice versa

---

## Phase 3: Create and view a todo (end of PR 1)

**User stories**: 1, 2, 3, 9, 14, 15, 17, 22, 23, 28, 29

### What to build

The first tracer bullet: `POST /todos` and `GET /todos/:id` through routing → validation → the `todos` module → Prisma → serialization. Introduce the `todos` module (create and getById only) and the wire serializer. Then make PR 1 reviewable: `README.md` endpoint table mapping the Foci brief's capabilities (including the two `PATCH` rows, marked as arriving in PR 2), `DEVELOPMENT.md` section for running the API, `docs/decisions.md` entries for every architectural decision above, and `CLAUDE.md` current-state update.

### Acceptance criteria

- [ ] Test: create with title only → 201; body has exactly the seven representation fields; `id` is a UUID; `description` and `dueDate` are `null`; `isCompleted` is `false`; `createdAt`/`updatedAt` are ISO strings
- [ ] Test: create with all fields → 201; `dueDate` echoes the same `YYYY-MM-DD` (no timezone drift); description preserved
- [ ] Test: create trims the title; `""` description is stored and returned as `null`
- [ ] Test: create rejections → 400 with `issues[].path`: missing title, `""`, whitespace-only, 201-char title, 2001-char description, invalid date, impossible date, wrong types, unknown field, malformed JSON; and no row is written in each case
- [ ] Test: 200-char title and 2000-char description are accepted end to end
- [ ] Test: `GET /todos/:id` returns the created todo byte-for-byte equal to the create response
- [ ] Test: unknown UUID → 404 `NOT_FOUND`; non-UUID → 400 `VALIDATION_ERROR` with `path: "id"`
- [ ] Test: a todo created through one app instance is readable through a second app instance on the same database (persistence between runs)
- [ ] `README.md` has the endpoint table; `DEVELOPMENT.md` documents `pnpm dev` and `PORT`; `docs/decisions.md` records Fastify, PATCH-only completion, error body, strict schemas, list envelope + ordering, single `todos` module, in-package schemas; `CLAUDE.md` reflects the new state and commands
- [ ] `pnpm typecheck` and `pnpm test` green; PR 1 opened

---

## Phase 4: List and delete

**User stories**: 8, 10, 19

### What to build

`GET /todos` returning `{ todos: [...] }` in `createdAt, id` order, and `DELETE /todos/:id` returning 204. Extend the `todos` module with list and remove.

### Acceptance criteria

- [ ] Test: empty database → 200 `{ todos: [] }`
- [ ] Test: three todos created in sequence come back in creation order with the full representation each
- [ ] Test: two todos with an identical `createdAt` (inserted directly via Prisma) come back ordered by `id`
- [ ] Test: list reflects a subsequent create and a subsequent delete
- [ ] Test: delete → 204 with an empty body; subsequent `GET /todos/:id` → 404; second `DELETE` → 404
- [ ] Test: delete unknown UUID → 404; non-UUID → 400 with `path: "id"`
- [ ] Test: deleting one todo leaves the others intact

---

## Phase 5: Update, complete, incomplete

**User stories**: 4, 5, 6, 7

### What to build

`PATCH /todos/:id` for partial updates of `title`, `description`, `dueDate`, and `isCompleted`, with `null` clearing the optional fields. This is also how the Foci brief's Complete and Incomplete are satisfied. Extend the `todos` module with update.

### Acceptance criteria

- [ ] Test: patch `title` only → 200; other fields unchanged; title trimmed
- [ ] Test: patch `description` only; patch `dueDate` only; each leaves the others unchanged
- [ ] Test: `description: null` and `dueDate: null` clear the field; `description: ""` also clears it
- [ ] Test: `isCompleted: true` → completed; then `isCompleted: false` → not completed; other fields unchanged
- [ ] Test: patching several fields at once applies all of them
- [ ] Test: `updatedAt` advances and `createdAt` is unchanged after a patch
- [ ] Test: `{}` → 400; `title: null` → 400; `title: ""` → 400; over-length title/description → 400; invalid/impossible date → 400; unknown field → 400; wrong types → 400
- [ ] Test: a rejected patch leaves the row byte-for-byte untouched, including `updatedAt`
- [ ] Test: unknown UUID → 404; non-UUID → 400 with `path: "id"`
- [ ] Test: the patched todo is returned identically by a subsequent `GET /todos/:id`
- [ ] `README.md` endpoint table no longer marks the `PATCH` rows as pending

---

## Phase 6: Coverage sweep (end of PR 2)

**User stories**: 25

### What to build

Run Vitest with coverage over the API package and read the report for the routes, error handler, schemas, serializer, and `todos` module. Add tests for any uncovered branch or line, and remove any dead branch that cannot be reached. Re-verify the docs against the final behaviour.

### Acceptance criteria

- [ ] Coverage report shows every branch of routes, error handler, schemas, serializer, and the `todos` module exercised
- [ ] Any new tests added are named for the behaviour they pin, not the line they cover
- [ ] `README.md`, `DEVELOPMENT.md`, `docs/decisions.md`, and `CLAUDE.md` match the shipped behaviour
- [ ] `pnpm typecheck` and `pnpm test` green; PR 2 opened

---

## Deferred (not in this plan)

- Sorting, filtering, searching, pagination, and indexes (the `todos` envelope reserves room)
- Users, authentication, authorization
- React UI; a shared contracts package for the zod schemas (they are kept Prisma-free so extraction is a file move)
- OpenAPI / generated clients
- `build` / `start` scripts, deployment, CI
