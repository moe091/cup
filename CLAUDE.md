# Cup (Nitecrew) — Claude Code Guide

## Project Overview

A pnpm TypeScript monorepo. Social hangout platform: Discord-like community chat + integrated casual multiplayer minigames.

## Monorepo Structure

```
apps/api          NestJS backend (auth, users, chat, communities, emojis, storage, games)
apps/web          React + Vite SPA
games/bouncer/    Physics game: engine / server / client / shared
games/template/   Scaffold for future games
packages/shared   Cross-app TypeScript types (user, chat, community, emoji, lobby)
docs/             Architecture, planning, and design docs
```

## Dev Setup

Prerequisites: Docker Desktop running (WSL), pnpm.

```bash
docker compose up -d              # start Postgres
pnpm run dev                      # all services in parallel (API, web, bouncer, shared watch)
pnpm run dev:api                  # API only
pnpm run dev:web                  # web only
```

Before committing:
```bash
pnpm lint
pnpm typecheck
pnpm test                         # API unit tests only
pnpm format
```

## Database

- Local dev DB: `flowt_dev` (auto-created by Docker Compose)
- Local test DB: `flowt_test`
- ORM: Prisma — schema at `apps/api/prisma/schema.prisma`
- Generated client output: `apps/api/src/generated/prisma`

```bash
pnpm exec prisma migrate dev --name <name>   # new migration (from apps/api or with --filter)
pnpm exec prisma generate                    # regenerate client after schema change
pnpm seed:dev                                # seed dev DB
pnpm seed:test                               # seed test DB
```

Always regenerate the Prisma client after schema changes.

## API Architecture (`apps/api`)

NestJS modular backend. Modules:
- `auth` — local login + Google/Discord OAuth (Passport), express-session
- `users` — profile, field-specific PATCH endpoints, avatar key management
- `storage` — S3 presigned upload/delete via AWS SDK
- `chat` — REST history + Socket.IO realtime gateway, chat tokens (short-lived JWT for socket handshake)
- `communities` — community CRUD + membership + permission levels
- `emojis` — custom emoji catalog/resolve
- `games` — bouncer levels + lobby management
- `prisma` — shared PrismaService
- `security` — CSRF middleware + in-memory rate limiting (applied globally)

Key patterns:
- IDs are UUIDs stored as strings
- `User` model maps to `account` db table (`@@map("account")`)
- Auth: session cookie (`express-session`), Passport serializes `userId` into session
- CSRF: `GET /api/auth/csrf` issues token; send as `x-csrf-token` on all mutating requests
- Enforce access in service methods (not only controllers) for reusable logic
- Custom exceptions: `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`

## Frontend Architecture (`apps/web`)

React SPA + Vite. Key conventions:

**"Dumb container" design pattern** (documented in `docs/system-design.md`):
- Container components (e.g. `MultiChannelChatPanel`) are bags of components with minimal wiring logic
- Atomic components (e.g. `ChannelList`) own their own business logic and API calls via hooks
- This reduces context/prop-drilling complexity at the cost of some co-location of logic with UI

Directory layout:
```
src/api/            API helper functions (one file per domain)
src/auth/           AuthContext, useAuth, LoginModal
src/features/chat/  Chat components + hooks
src/features/communities/  Community components + hooks
src/routes/         Page-level route components
src/panels/         Shared layout panels (TopBar)
src/components/     Shared common components
src/config/         Config helpers (s3.ts for avatar URL resolution)
src/theme/          Theme config
```

S3 avatar URLs: resolved via `buildS3AssetUrl` in `src/config/s3.ts` using `VITE_S3_BASE_URL` env var.

Fetch conventions:
- Always `credentials: "include"` for session-cookie auth
- Always `cache: "no-store"` for user/auth/chat data
- Always `x-csrf-token` header on mutating requests (POST/PATCH/PUT/DELETE)
- Always `Content-Type: application/json` when sending JSON body

## Bouncer Game (`games/bouncer/`)

```
engine/    planck.js box2d physics. Tick via step(). Accepts input vectors per playerId.
server/    Socket.IO rooms per match. One Match instance per lobby. Owns Engine instance.
client/    Phaser visual renderer. Dumb — renders server state, sends input to server.
           Also contains the level editor (tool-based: PlatformTool, SpawnPointTool, etc.)
shared/    Level types shared between engine/server/client
```

Networking: clients emit player state updates; server validates/rebroadcasts to other clients. Not fully server-authoritative yet.

## Current Implementation Status

**Done:**
- Auth (local + OAuth), session management, CSRF, rate limiting
- User profile (field-specific updates, avatar upload via presigned S3)
- Chat: history + realtime (Socket.IO), emoji, reactions, replies, message grouping, channel management
- Communities: create/discover/join/leave/delete, community settings page
- Bouncer game: engine/server/client/level editor

**In progress / next:**
- Name color tokens: profile picker + `nameColorToken` field + chat integration
- Avatar + name color in chat message payloads and MessageRow rendering
- Friends system + DMs (future, larger project)

See `docs/todos.md` for the current task list and `docs/community-chat-plan.md` for near-term chat/community work.

## TypeScript / Code Conventions

Follow the mental checklist in `docs/mental-checklist.md` for any non-trivial function:
1. Types and shapes (raw input vs parsed/internal)
2. Input parsing and validation (range checks, pair deps, defaults, caps)
3. Auth + access control
4. Transport details (method, credentials, CSRF, Content-Type)
5. Error strategy
6. Call-site ergonomics
7. State and async safety (frontend)
8. Contract alignment across layers

Key rules:
- Raw input types reflect reality (`string | undefined` for query params)
- Parsed/internal types reflect business intent (typed, required where required)
- Shared API response DTOs live in `packages/shared`; backend-only input types stay in API
- Dates: return ISO strings from API responses
- Don't add validation for impossible scenarios; validate at trust boundaries only

## Docs Folder

`docs/` contains architecture decisions, implementation plans, and dev setup notes. Ask before updating any doc file — the user manages them.

Key files:
- `docs/system-design.md` — architecture decisions and design rationale (source of truth)
- `docs/todos.md` — current task priorities
- `docs/sdlc.md` — environments, DB workflow, seeding, CI/CD commands
- `docs/mental-checklist.md` — code quality checklist
- `docs/goals.md` — product vision and feature requirements

## Working with Me (Claude Code)

- **Plan before coding**: I'll outline my approach and wait for confirmation before writing non-trivial code.
- **Convention deviations**: I'll explicitly flag any time I'm making a tradeoff against the documented patterns (dumb-container, mental checklist, TypeScript conventions).
- **Doc updates**: I'll ask before updating any file in `docs/`.
