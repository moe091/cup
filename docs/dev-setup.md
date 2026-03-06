---
description: Fresh machine setup checklist for local development.
---

## Local Dev Setup Checklist

1. Clone repo and install dependencies

- `git clone <repo-url>`
- `cd cup`
- `corepack enable`
- `pnpm install`

2. Configure environment variables

- Copy API env template and fill values:
  - `cp apps/api/.env.example apps/api/.env`
- Minimum required for local bring-up:
  - `DATABASE_URL`
  - `DATABASE_URL_TEST`
  - `SESSION_SECRET`
  - `CHAT_TOKEN_SECRET`

3. Start local Postgres (Docker)

- Make sure Docker Desktop is running on Windows/WSL.
- Start DB container:
  - `docker compose up -d`
- Verify DB is healthy:
  - `docker compose ps`

4. Initialize database schema

- Apply migrations to dev DB:
  - `pnpm --filter @cup/api exec prisma migrate dev --name init_local`

Notes:

- `flowt_dev` is created automatically by `POSTGRES_DB=flowt_dev` in `docker-compose.yml`.
- `flowt_test` is created by `docker/postgres/init/01-create-test-db.sql` on first DB container initialization.

5. Seed development data

- `pnpm --filter @cup/api seed:dev`

6. Build shared types (if needed)

- `pnpm build:types`

7. Start application processes

- All projects: `pnpm run dev`
- API only: `pnpm run dev:api`
- Web only: `pnpm run dev:web`

8. Optional verification

- API typecheck: `pnpm --filter @cup/api typecheck`
- All lint: `pnpm lint`
- All tests: `pnpm test`

## Test DB Schema Setup (Local)

When you need test DB schema aligned with latest migrations, run migration commands against `DATABASE_URL_TEST`:

```bash
DATABASE_URL="$DATABASE_URL_TEST" pnpm --filter @cup/api exec prisma migrate deploy
```

If your shell does not have `DATABASE_URL_TEST` exported, use explicit URL inline:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flowt_test?schema=public" pnpm --filter @cup/api exec prisma migrate deploy
```

Then seed test fixtures:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flowt_test?schema=public" pnpm --filter @cup/api seed:test
```

## Useful Local DB Commands

- Open psql for dev DB:
  - `docker compose exec db psql -U postgres -d flowt_dev`
- Open psql for test DB:
  - `docker compose exec db psql -U postgres -d flowt_test`
- List all DBs:
  - `docker compose exec db psql -U postgres -tAc "SELECT datname FROM pg_database ORDER BY datname;"`
