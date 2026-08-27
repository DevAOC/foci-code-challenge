---
name: do-work
description: Disciplined plan → implement → verify → commit loop for a piece of work in this repo. Verifies with `pnpm typecheck` and `pnpm test` before committing. Use when the user says "do this work", "implement this", "build this feature/fix", or hands off a task to be carried through to a commit.
---

# Do Work

Carry a piece of work from request to committed code through four phases. Do not
skip phases. Do not commit until verification passes.

## 1. Plan

- Restate the goal in one or two sentences so scope is explicit.
- Identify the files to change and the order of changes.
- For anything non-trivial, lay out the plan before editing. If requirements are
  ambiguous or a decision is genuinely the user's, ask before implementing.

## 2. Implement

- Make the changes, matching the surrounding code's style and conventions.
- Keep changes scoped to the stated goal — note unrelated issues, don't fix them.

## 3. Verify (feedback loop)

Run both, fix what they surface, and re-run until **both pass clean**:

```bash
pnpm typecheck   # react-router typegen && tsc
pnpm test        # vitest run
```

- Treat failures as the signal to keep iterating, not as a stopping point.
- If a failure is pre-existing and unrelated to your change, say so explicitly
  rather than silently leaving it or "fixing" out-of-scope code.
- Do not move to commit while either command is failing.

## 4. Commit

Only after verification is green:

- Stage the files you changed (be specific; don't blanket-add unrelated work).
- Write a concise message describing the change. Match the repo's recent style.
- Commit. End the message with:

  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

- Report what was committed (files + one-line summary) and the verification result.

## Checklist

- [ ] Goal restated
- [ ] Work implemented, scoped to the goal
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Changes committed with a clear message
