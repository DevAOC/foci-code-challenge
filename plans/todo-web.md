# Plan: Todo web app (Vite + React + shadcn over the `/todos` API)

> Source PRD: https://github.com/DevAOC/foci-code-challenge/issues/6 (2026-08-27). Builds on the HTTP API from PRD #3 / `plans/todo-api.md`.

## Scope

Deliver a single-page React front end for the todo API, shipped as **two PRs**:

- **PR A — phases 0–1** (API side, on `api-addons`): `dueDate` gains time-of-day; validation schemas and wire types extracted to a shared `@foci/contracts` package. No web code.
- **PR B — phases 2–6** (web side): the `@foci/web` package, one tracer bullet per phase.

Each phase is one commit, built red → green → refactor with the `tdd` skill. `pnpm typecheck`, `pnpm test`, and (from phase 2) the web `build` are green at every commit. Tests are a first-class deliverable: every phase lists the named test cases it must add.

## Architectural decisions

Durable decisions that apply across all phases (rationale in PRD #6; `docs/decisions.md` is updated in phases 0, 1, and 6):

- **Packages**: `apps/web` = `@foci/web` (Vite `react-ts`, React 19, TypeScript, ESM). `packages/contracts` = `@foci/contracts` (zod only, no build step; source imported directly). Workspace globs `apps/*` and `packages/*`. Both `@foci/api` and `@foci/web` depend on `@foci/contracts` via `workspace:*`.
- **Screen**: one page, no router. Header (title + **New** button) above a vertical stack of todo cards. Modal open/closed and the todo being edited are React state.
- **Card**: a container with two *sibling* interactive children — a checkbox (toggles `isCompleted`) and a full-width button (opens the edit modal). Never nested. Shows title, due date/time, description, done state. Completed cards stay in place, struck-through and muted.
- **Form**: one `TodoForm` in a Radix Dialog (shadcn) serves create (empty) and edit (prefilled). Fields: title, description, due date/time (`datetime-local`), completed (edit only). Validates with the shared schema's `safeParse` before submitting and sends the *parsed* output. Server `400 issues[]` map onto fields as a fallback; non-field errors show at the top of the form, which stays open with input intact. Edit sends only changed fields; Save is disabled while nothing has changed, the title is empty, or a request is in flight. Delete lives in the edit modal footer with an inline two-step confirm.
- **Due date**: DB column `due_date timestamptz NULL`. Wire: ISO 8601 with offset, normalized to UTC on output (`2026-09-03T15:00:00.000Z`), or `null`; `null` clears on update. Form input in the browser's local zone, converted to an instant on submit. Display via `Intl.DateTimeFormat` in the browser's zone, e.g. "Sep 3, 3:00 PM", year appended only when not the current year. Overdue = `now > dueDate` and not completed. No date library.
- **Contracts package exports**: create/update/id-param schemas and inferred input types, `TITLE_MAX_LENGTH` / `DESCRIPTION_MAX_LENGTH`, the `TodoResponse` wire type, the `ErrorBody` envelope type. Schemas live here and nowhere else.
- **Data fetching**: TanStack Query. One list query keyed `['todos']`; create/update/delete mutations invalidate it; the completion toggle is an optimistic update on the list cache with rollback + toast on error. A thin typed fetch client uses relative `/api/...` URLs and throws `ApiError { statusCode, code, message, issues? }` parsed from the error envelope. The edit modal is populated from the loaded list item, not a per-todo fetch.
- **Dev wiring**: Vite proxies `/api/*` → `http://127.0.0.1:3000` with the `/api` prefix stripped. No CORS, no `VITE_*` variables. Root `pnpm dev` runs API and web in parallel. Web scripts: `dev`, `build`, `typecheck`, `test`, `test:coverage`. Nothing serves `dist/`.
- **Styling**: Tailwind v4 via the Vite plugin; shadcn/ui `dialog`, `button`, `input`, `textarea`, `checkbox`, `label`, `sonner`, `skeleton`. Stripe-like: near-white ground, Inter with system fallback, hairline borders, small radii, one indigo accent, restrained motion.
- **Accessibility baseline**: labelled inputs; field errors linked via `aria-describedby`; pending submit disabled; `role="status"` / `role="alert"` for notices; modal traps and restores focus (Radix); all interactive elements reachable and operable by keyboard.
- **Testing**: Vitest + jsdom + React Testing Library; MSW intercepts `fetch` at the network boundary with handlers typed against `@foci/contracts`; tests render the whole `App` with a real Query client and query the DOM with accessible selectors. Fetch client and date formatter are unit-tested. No mocking of modules the app owns. Web tests need neither Postgres nor a port. API changes are tested through the existing `inject` seam against `foci_test`.
- **Auth / tenancy**: none (unchanged).

---

## Phase 0: Due date gains time-of-day

**User stories**: 37, 39, 49

### What to build

Change `due_date` from `date` to `timestamptz` with one migration (no data to move). The wire format for `dueDate` becomes an ISO 8601 instant with offset, validated by the create/update schemas and normalized to UTC on output; a bare `YYYY-MM-DD` is now rejected. Remove the calendar-date helpers. Amend the `date`-over-`timestamptz` entry in `docs/decisions.md` with the new information (time-of-day is a product requirement) rather than deleting it, and update the API README's field table.

### Acceptance criteria

- [ ] Migration alters `todos.due_date` to `timestamptz`; `pnpm db:migrate` and the test global setup apply it cleanly
- [ ] Schema test: `2026-09-03T15:00:00Z`, `2026-09-03T15:00:00.000Z`, and `2026-09-03T11:00:00-04:00` accepted; `2026-09-03`, `2026-09-03T15:00:00` (no offset), `2026-02-30T00:00:00Z`, and non-strings rejected; `null` still accepted on update and rejected on create
- [ ] HTTP test: create with `dueDate: "2026-09-03T11:00:00-04:00"` → 201 with `dueDate: "2026-09-03T15:00:00.000Z"` (normalized to UTC), and `GET /todos/:id` returns the same value
- [ ] HTTP test: create with `dueDate: "2026-09-03"` → 400 with `issues[].path === "dueDate"`
- [ ] HTTP test: update `dueDate` to a new instant → 200 reflecting it; update to `null` → 200 with `dueDate: null`
- [ ] Existing create/list/update tests updated to the new format and still green; the calendar-date helper tests are removed with the helpers
- [ ] `docs/decisions.md` records the reopening and the new wire format; `README.md` field table updated
- [ ] `pnpm typecheck` and `pnpm test` green

---

## Phase 1: Extract `@foci/contracts`

**User stories**: 46

### What to build

Create the `packages/contracts` workspace package and move the validation schemas (with their tests), the `TodoResponse` wire type, and the `ErrorBody` envelope type into it. The API imports them from `@foci/contracts`; its serializer keeps the Prisma-facing function. No behaviour changes — the existing HTTP tests are the proof. Record the shared-contracts decision in `docs/decisions.md` (superseding the "schemas live in the API package" entry) and update `CLAUDE.md` layering.

### Acceptance criteria

- [ ] `pnpm-workspace.yaml` includes `packages/*`; `@foci/contracts` has `typecheck` and `test` scripts and is picked up by the root `pnpm typecheck` / `pnpm test`
- [ ] Contracts exports exactly the schemas, input types, length constants, `TodoResponse`, and `ErrorBody`; it depends on zod only
- [ ] The API has no schema module of its own; routes, service, serializer, and error handler import from `@foci/contracts`
- [ ] The moved schema tests pass unchanged in the contracts package; the API's HTTP test suite passes unchanged
- [ ] A single zod version is resolved across the workspace (`pnpm why zod` shows one)
- [ ] `docs/decisions.md` and `CLAUDE.md` describe the contracts layering rule
- [ ] `pnpm typecheck` and `pnpm test` green; PR A opened

---

## Phase 2: Web scaffold and the read-only list

**User stories**: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 44, 45, 47, 48

### What to build

The first web tracer bullet: a running `@foci/web` that renders the real todos from `GET /todos` as cards. Scaffold Vite + React + Tailwind v4 + shadcn (`button`, `skeleton`), the `/api` proxy, root `pnpm dev` starting both servers, TanStack Query, and the typed fetch client. The page shows the header with a **New** button (present but inert until phase 3) and the card stack — title, due date/time via the formatter, description, muted/struck-through when completed — with skeleton, empty-state (CTA inert until phase 3), and inline error + Retry states. Set up the test harness: Vitest + jsdom + RTL + MSW with a `renderApp` helper and typed handlers; unit tests for the fetch client and the formatter.

### Acceptance criteria

- [ ] `pnpm dev` at the root starts the API and the web app; the browser at the Vite URL shows todos created via the API; `/api/todos` proxies to `/todos`
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm --filter @foci/web build` green; `pnpm --filter @foci/web test:coverage` runs
- [ ] App test: three todos from the fake API render as three cards in the order received, each showing title, formatted due date, and description
- [ ] App test: a todo with `description: null` and `dueDate: null` renders neither line
- [ ] App test: a completed todo is rendered with done styling (assert via an accessible state or class contract, not a snapshot)
- [ ] App test: skeleton cards are shown while the list request is pending
- [ ] App test: an empty list shows the empty state with a "create your first todo" action
- [ ] App test: a failed list request shows an inline error with Retry; clicking Retry refetches and shows the cards
- [ ] Client test: 2xx JSON is returned typed; 204 resolves to `undefined`; a 4xx/5xx envelope becomes `ApiError` with `statusCode`, `code`, `message`, `issues`; a network failure rejects with a non-`ApiError` error
- [ ] Formatter test: renders in the browser's zone; omits the year when current; appends it otherwise; overdue is true only when past and incomplete; a fixed `TZ` in the test config makes results deterministic
- [ ] No `VITE_*` variables; no CORS added to the API

---

## Phase 3: Create a todo from the New modal

**User stories**: 12, 13, 14, 15, 16, 17, 18, 19, 20, 28, 29, 38, 41, 42

### What to build

Wire the **New** button and the empty-state CTA to a modal containing `TodoForm` in create mode (title, description, due date/time). The form validates with the shared create schema before submitting, converts the local `datetime-local` value to an ISO instant, sends the parsed output to `POST /todos`, invalidates the list on success, and closes. Server `400 issues[]` map onto fields; other failures show at the top of the form and keep it open. Add shadcn `dialog`, `input`, `textarea`, `label`.

### Acceptance criteria

- [ ] App test: click New → a dialog with labelled Title, Description, and Due inputs and focus inside it; Escape closes it and returns focus to New
- [ ] App test: fill title and submit → `POST /todos` body is exactly the parsed schema output (trimmed title, `"" → null` description, no `dueDate` key when blank); the dialog closes and the new card appears
- [ ] App test: enter a local date-time → the request's `dueDate` is the corresponding ISO instant with `Z` offset
- [ ] App test: whitespace-only title → no request; "Title must not be empty" shown under the field and linked via `aria-describedby`
- [ ] App test: 201-char title / 2001-char description → no request; the length message shown under the field
- [ ] App test: fake API returns 400 with `issues: [{ path: "title", … }]` → message under Title, dialog stays open
- [ ] App test: fake API returns 500 → generic message at the top of the form, dialog stays open, entered values preserved
- [ ] App test: Save is disabled and shows a pending state while the request is in flight; pressing Enter in the title field submits
- [ ] App test: the empty-state CTA opens the same dialog
- [ ] `pnpm typecheck`, `pnpm test`, web `build` green

---

## Phase 4: Edit and delete from the card

**User stories**: 21, 22, 23, 24, 25, 26, 27, 34, 35, 36

### What to build

Clicking a card's open-button opens the same modal in edit mode, prefilled from the list item (due instant converted back to local wall-clock; a Completed checkbox added). Save is disabled until something changes and sends only changed fields via `PATCH /todos/:id`; clearing description or due sends `null`. A 404 on save shows "this todo no longer exists" and refreshes the list. The footer holds a quiet Delete button that swaps to an inline "Delete / Cancel" confirmation; confirming sends `DELETE /todos/:id`, closes, and invalidates the list.

### Acceptance criteria

- [ ] App test: click a card → dialog prefilled with its title, description, local due date-time, and completed state; Save disabled
- [ ] App test: change only the title → `PATCH` body is `{ title }` and nothing else; card shows the new title after close
- [ ] App test: clear description and due → `PATCH` body is `{ description: null, dueDate: null }`
- [ ] App test: tick Completed in the form → `PATCH` body is `{ isCompleted: true }`
- [ ] App test: revert a change to its original value → Save disabled again
- [ ] App test: fake API returns 404 on `PATCH` → not-found message shown; list refetched and the stale card gone
- [ ] App test: 400 `issues` and 500 on save behave as in phase 3
- [ ] App test: click Delete → inline confirmation replaces the footer, no request yet; Cancel restores the footer; confirm → `DELETE /todos/:id`, dialog closes, card gone
- [ ] App test: keyboard — Tab to a card's open-button and press Enter opens the dialog
- [ ] `pnpm typecheck`, `pnpm test`, web `build` green

---

## Phase 5: Toggle completion from the card

**User stories**: 4, 30, 31, 32, 33, 40, 43

### What to build

Add the sibling checkbox to each card. Ticking sends `PATCH /todos/:id { isCompleted }` with an optimistic update to the list cache so the card restyles immediately; on failure the cache rolls back and a transient toast announces it. Toggling never opens the edit modal. Add shadcn `checkbox` and `sonner`.

### Acceptance criteria

- [ ] App test: tick a card's checkbox → `PATCH` body `{ isCompleted: true }`; the card shows done styling before the response resolves; untick → `{ isCompleted: false }`
- [ ] App test: fake API returns 500 → the checkbox and styling roll back and a toast with `role="status"`/`alert` appears with a "couldn't update" message
- [ ] App test: the completed card keeps its position in the list
- [ ] App test: clicking the checkbox does not open the dialog; clicking the card body does not change the checkbox
- [ ] App test: keyboard — Tab reaches the checkbox before the open-button; Space toggles it
- [ ] The checkbox has an accessible name that includes the todo's title
- [ ] `pnpm typecheck`, `pnpm test`, web `build` green

---

## Phase 6: Polish, docs, and coverage

**User stories**: 48, plus a sweep of 5–8, 40–43

### What to build

Make it look like the brief: apply the Stripe-like tokens (ground, type, borders, radii, accent, motion) consistently across header, cards, dialog, and form; overdue tint on incomplete past-due cards; hover/focus-visible states. Run an accessibility sweep against the baseline (labels, `aria-describedby`, roles, focus order, contrast). Add a coverage run over the web source. Update `README.md` (how to run the whole app), `DEVELOPMENT.md` (web dev, proxy, tests), `CLAUDE.md` (current state, commands, web layering), and `docs/decisions.md` (front-end decisions: no router, form-in-modal, sibling card controls, TanStack Query, Tailwind + shadcn, MSW at the network boundary, Vite proxy).

### Acceptance criteria

- [ ] App test: an incomplete todo with a past due date renders its due date with the overdue treatment; a completed past-due todo does not
- [ ] Every interactive element has a visible focus ring; the a11y checklist in the PRD is met and any gaps are fixed with tests where behaviour changed
- [ ] `pnpm --filter @foci/web test:coverage` reports on all web source with no untested module
- [ ] `README.md`, `DEVELOPMENT.md`, `CLAUDE.md`, and `docs/decisions.md` updated as listed
- [ ] `pnpm typecheck`, `pnpm test`, web `build` green; PR B opened
