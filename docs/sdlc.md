---
description: SDLC, environments, database workflows, seeding strategy, testing, CI/CD, and command reference.
---

## Quick Commands

- Start local docker services (Postgres): `docker compose up -d`
- Open psql in docker Postgres: `docker compose exec db psql -U postgres -d flowt_dev`
- Run all main dev processes in monorepo: `pnpm run dev`
- Run API only (watch): `pnpm run dev:api`
- Run web only (watch): `pnpm run dev:web`
- Run API migrations (local dev): `pnpm exec prisma migrate dev --name <migration_name>`
- Generate Prisma client: `pnpm exec prisma generate`
- Seed API database: `pnpm @cup/api seed`
- Seed API database (dev mode): `pnpm seed:dev`
- Seed API database (test mode): `pnpm seed:test`
- Seed API database (base mode): `pnpm seed:base`
- Lint all packages: `pnpm lint`
- Auto-fix lint: `pnpm lint:fix`
- Typecheck all packages: `pnpm typecheck`
- Format check all packages: `pnpm format`
- Auto-fix formatting: `pnpm format:fix`
- Run tests (root): `pnpm test`

Notes:

- On Windows + WSL, don't forget to run Docker Desktop so compose commands work

## Database Names (Current and Planned)

- Current local dev DB: `flowt_dev`
- Current local test DB: `flowt_test`
- Planned staging DB name: `flowt_staging`
- Planned production DB name: `flowt_prod`

Creation behavior in local docker:

- `flowt_dev` is created by Postgres automatically from `POSTGRES_DB=flowt_dev` in `docker-compose.yml`.
- `flowt_test` is created by init SQL on first initialization via `docker/postgres/init/01-create-test-db.sql`.

## Environment Strategy

### Dev (Implemented)

- Purpose: active development with realistic seeded data.
- DB: `flowt_dev`.
- Migrations: `prisma migrate dev`.
- Seeds: `pnpm run seed:dev` (in apps/api).

### Test (Partially Implemented)

- Purpose: deterministic automated testing.
- DB: `flowt_test`.
- DB exists in local docker setup.
- Planned refinement:
  - isolate test fixtures from dev fixtures.
  - reset and reseed test DB in test setup/CI before integration tests.

### Staging (Planned)

- Purpose: pre-production validation on production-like infrastructure.
- DB: `flowt_staging` (separate from prod).
- Deployment: separate environment/stack from production.
- Data policy:
  - no production PII by default.
  - use baseline + staging-safe seed datasets.

### Production (Planned)

- Purpose: live customer environment.
- DB: `flowt_prod`.
- Migration policy: `prisma migrate deploy`.
- No dev/demo seed data.

### Production HTTPS/TLS Plan (AWS)

- Terminate TLS at AWS edge/load balancer using ACM certificates (no plaintext public traffic).
- Use Route53 DNS + ACM cert validation for production domain and any required subdomains.
- Route browser traffic over `https://` only and redirect `http://` to `https://`.
- Keep session cookies as `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production.
- Verify app is proxy-aware in production networking (so secure cookie/session behavior is correct behind ALB/reverse proxy).
- Set strict `CORS_ALLOWED_ORIGINS` to deployed frontend origins only (no wildcard with credentials).
- Update OAuth callback/base URLs to production HTTPS domains before launch.
- Add post-deploy check: login, logout, CSRF token issuance, and authenticated API requests over HTTPS.

## Seeding Strategy

### Current (Implemented)

- Single API seed script: `apps/api/prisma/seed.ts`.
- Seed sources:
  - bouncer levels from `apps/api/prisma/seed-data/bouncer/*.json`
  - users from `apps/api/prisma/seed-data/userSeed.json`
- Seed users include login-capable `passwordHash` values generated at seed time using `hashPassword`.

### Modes (Implemented + Planned)

- Keep one seed entrypoint but add explicit mode args:
  - `--mode=dev`
  - `--mode=test`
  - `--mode=base`
- Keep mode and target DB as independent controls where useful.
- Suggested command shape:
  - `pnpm --filter @cup/api seed -- --mode=dev`
  - `pnpm --filter @cup/api seed -- --mode=test`

Current implementation status:

- `--mode=dev`, `--mode=test`, and `--mode=base` are implemented in `apps/api/prisma/seed.ts`.
- `seed:dev`, `seed:test`, and `seed:base` scripts are available in `apps/api/package.json`.

## Prisma Migration and DB Lifecycle

### Current Commands

- Local schema changes:
  - `pnpm --filter @cup/api exec prisma migrate dev --name <name>`
- Regenerate Prisma client:
  - `pnpm --filter @cup/api exec prisma generate`


## Testing Strategy

### Unit Tests (Implemented)

- Scope: individual services/controllers/middleware with mocks.
- Existing examples in API auth/users/security modules.

### Integration Tests (Planned expansion)

- Scope: run real API modules against a real test database.
- Tooling: Jest + Supertest.
- Pattern:
  - prepare/reset test DB
  - seed deterministic test fixtures
  - call HTTP endpoints and assert DB and response behavior

### Browser E2E Tests (Planned)

- Scope: user journeys through real frontend + API.
- tooling: Playwright.
- Initial target flow for chat:
  - login
  - open chat surface
  - connect socket
  - join channel
  - load history and send message
  - include other features as added(respond, react, ban/timeout, ping/@, etc)

## CI/CD

### Current CI (Implemented)

File: `.github/workflows/ci.yml`

Current pipeline runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm build:types`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm format`
6. `pnpm test`

### Planned CI Improvements

- Add Postgres service in CI job for integration tests.
- Apply migrations to CI test DB before running integration tests.
- Seed with test-mode fixtures.
- Add browser E2E smoke checks on main or protected branches.

### Planned CD Pattern

- Deploy to staging after CI passes on main.
- Manual approval gate to production.


## Chat-Specific SDLC Notes

- Chat schema and seed data now exist in development flow.
- Chat socket auth uses REST-issued JWT handshake tokens.
- Current architecture keeps chat in `apps/api`; service extraction is explicitly deferred until performance/scale needs justify it.
