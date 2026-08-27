# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

`foci-code-challenge` is a freshly initialized repository with no application code yet. There is no `package.json`, build, lint, or test setup — do not assume any commands exist. Once tooling is added, update this file with the real build/test/lint commands (including how to run a single test).

## Repository layout

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
