---
description: Workflows, CI notes, and build quirks.
---

## Development workflow

- `pnpm run dev` → runs all services with watchers.
- Feature complete → `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (API only).
- Commit + push → CI runs automatically on PR.


## Project commands

- `pnpm run dev` (root)
- `pnpm run lint` (root)
- `pnpm run typecheck` (root)
- `pnpm run test` (root)

All commands also work in all subprojects(besides test which is only in api atm)


## General guidelines

Adhere to typescript best practices and general professional software development principles
