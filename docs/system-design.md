---
description: Architectural decisions and system design notes across the monorepo.
---

## Purpose

This document tracks architecture decisions, rationale, tradeoffs, and planned evolution paths.

Scope:

- Backend/API architecture
- Auth/session/security design
- Database and data modeling direction
- Frontend architecture
- Bouncer game architecture (server/client/networking/editor)
- Chat architecture plan and scaling strategy

## Current system snapshot

- Monorepo managed with pnpm workspaces.
- Main apps:
  - `apps/api` (NestJS + Prisma + PostgreSQL)
  - `apps/web` (React + Vite)
  - `games/bouncer/*` (engine/server/client/shared)
  - `packages/shared` (cross-app TS types)
- Local dev: root `pnpm run dev` runs API, web, bouncer projects, and shared type watch/build flows.

## Decision log

### D-001 Monorepo structure

- Status: accepted
- Decision: keep API, web, game runtime(s), and shared types in one monorepo.
- Why:
  - fast cross-project iteration
  - simpler shared typing between frontend/backend/game packages
  - one CI/lint/typecheck workflow
- Tradeoffs:
  - potentially longer full-repo CI as codebase grows
  - requires discipline around package boundaries to avoid tight coupling
- Future options:
  - keep monorepo while splitting deployables independently (recommended)
  - adopt more granular build caching and selective CI execution as scale grows

### D-002 API framework: NestJS modular backend

- Status: accepted
- Decision: use NestJS module architecture in `apps/api`.
- Why:
  - clear module boundaries (`AuthModule`, `UsersModule`, `GamesModule`, etc.)
  - strong TypeScript support and mature middleware/guard ecosystem
  - straightforward fit for session-based auth and REST endpoints
- Tradeoffs:
  - framework conventions and boilerplate overhead vs minimal frameworks
- Future options:
  - add dedicated modules for chat, friends, guild/community domains
  - extract modules into separate deployables only when scale or team ownership requires it

### D-003 Database/ORM: PostgreSQL + Prisma

- Status: accepted
- Decision: use PostgreSQL with Prisma as data access layer.
- Why:
  - relational model fits accounts, memberships, lobbies, levels, and chat
  - Prisma provides schema-driven migrations and typed client APIs
  - good TypeScript ergonomics for API layer
- Tradeoffs:
  - some advanced SQL patterns are less ergonomic through ORM abstractions
  - schema evolution still requires careful migration discipline
- Current implementation notes:
  - custom Prisma client output under `apps/api/src/generated/prisma`
  - uses `@prisma/adapter-pg` adapter in `PrismaService`
- Future options:
  - read replicas and query tuning for heavy read paths
  - partitioning/retention strategies for high-volume chat/message tables

### D-004 Auth strategy: session-based auth + Passport (local + OAuth)

- Status: accepted
- Decision:
  - use `express-session` cookie auth
  - use Passport for local auth plus Google/Discord OAuth
  - store serialized user id in session, hydrate user on deserialize
- Why:
  - simple and reliable login/logout semantics for web app
  - OAuth integration with existing Passport strategy ecosystem
  - avoids JWT revocation/rotation complexity for current app scope
- Current behavior:
  - local signup/login endpoints
  - OAuth callback flow for Google and Discord
  - explicit logout with `req.logOut`, session destroy, and cookie clear
- Tradeoffs:
  - horizontal scaling requires shared session store in production
  - cookie/session handling complexity for cross-origin deployments
- Future options:
  - Redis-backed session store for multi-instance deployments
  - account-linking flows between local and OAuth identities

### D-005 Security baseline: CSRF + route rate limiting

- Status: accepted
- Decision:
  - CSRF token stored in session and sent via `x-csrf-token`
  - in-memory route/IP rate limiting middleware for sensitive routes
- Why:
  - protects session-authenticated mutating routes from CSRF
  - adds low-cost abuse protection for login/signup/profile mutations
- Current behavior:
  - CSRF token endpoint: `GET /api/auth/csrf`
  - CSRF required for mutating routes except OAuth callbacks
  - specific rate limits for auth/profile endpoints
- Tradeoffs:
  - in-memory rate limiter is per-process only (not distributed)
- Future options:
  - Redis-backed distributed rate limits
  - additional abuse protections (device fingerprinting/challenges if needed)

### D-006 Frontend architecture: React SPA with route-level lazy loading

- Status: accepted
- Decision: React + Vite SPA in `apps/web`, with lazy-loaded route chunks for larger game surfaces.
- Why:
  - fast dev loop and simple deployment model
  - good fit for embeddable components and feature modules
  - lazy loading isolates heavy game areas from core pages (`/`, `/profile`)
- Tradeoffs:
  - no SSR currently (acceptable for current product goals)
- Future options:
  - add frontend feature modules for chat/friends/community
  - evaluate SSR/partial hydration only if product needs SEO-heavy public surfaces

### D-007 Shared type boundaries

- Status: accepted
- Decision:
  - keep cross-app product DTOs in `packages/shared`
  - keep game-specific types in `games/bouncer/shared`
- Why:
  - avoids accidental coupling between generic product types and game-specific protocols
  - preserves clear ownership boundaries
- Tradeoffs:
  - requires build/watch discipline to keep generated declarations current
- Future options:
  - add shared chat contracts in `packages/shared` once chat implementation starts

### D-008 Bouncer architecture: multi-package game runtime

- Status: accepted (current implementation)
- Decision:
  - split bouncer into engine/server/client/shared packages
  - web app embeds game client package
  - dedicated bouncer Socket.IO server manages matches/rooms
- Why:
  - isolates game loop concerns from web/app API concerns
  - allows game package reuse and independent iteration
  - match/lobby partitioning maps naturally to Socket.IO rooms
- Current implementation notes:
  - API creates/joins lobbies and mints short-lived game tickets
  - bouncer server validates ticket and assigns socket to match room
  - each match maintains in-memory match state and lifecycle
  - level content loaded from API on demand
- Tradeoffs:
  - currently relies on in-memory match state in single process
  - scaling requires match routing/session affinity strategy and lifecycle persistence hooks
- Future options:
  - multi-instance match hosting with deterministic match-to-node routing
  - explicit match registry/coordinator if dynamic balancing is needed

### D-009 Bouncer networking model (current)

- Status: accepted (current implementation)
- Decision:
  - clients run local simulation and emit player state updates (`seq`, position/velocity/angle)
  - server validates shape/basic sanity and rebroadcasts remote states to other players
  - remote clients smooth/interpolate/extrapolate incoming states
- Why:
  - responsive local controls without waiting for round-trip latency
  - straightforward implementation for current gameplay iteration stage
- Current implementation notes:
  - client sends player state at active/idle rates
  - server attaches `serverTimeMs`, broadcasts with `broadcastExcept`
  - client `RemoteSmoother` buffers snapshots with sequence checks and interpolation delay
- Tradeoffs:
  - trust model is relatively weak vs fully server-authoritative simulation
  - anti-cheat and strict state validation are limited in current stage
- Future options:
  - migrate to stronger server-authoritative or hybrid prediction + reconciliation model
  - enforce tighter server-side constraints and correction flows

### D-010 Bouncer level editor architecture

- Status: accepted (current implementation)
- Decision:
  - level editor implemented as Phaser scenes/tools in bouncer client package
  - API persists level definitions in Postgres via bouncer endpoints
- Why:
  - direct visual authoring in same rendering/runtime stack as gameplay
  - simple JSON-based level schema allows fast iteration
- Current capabilities:
  - platform/polygon/spawn/goal placement
  - grid snapping, camera pan/zoom, object selection/delete
  - save/load through API endpoints
- Tradeoffs:
  - editor UX and validation still evolving
  - additional moderation/versioning workflows not implemented yet
- Future options:
  - richer editor affordances (undo/redo, validation overlays, version history)
  - publish workflows and moderation/review tools

### D-011 Chat architecture (planned)

- Status: accepted (initial implementation path)
- Decision:
  - one modular chat architecture with `Community` (optional container) and `Channel` (message surface)
  - one reusable React chat panel keyed by `channelId`
  - one chat backend inside `apps/api` initially (REST + Socket.IO), not a separate `apps/chat` service initially
- Why:
  - centralizes auth and permission logic with existing session-backed identity
  - minimizes early distributed-systems complexity while contracts stabilize
  - keeps future extraction path open by enforcing clear module boundaries
- Functional scope (v1 target):
  - text + image/gif embeds, emojis, reactions, custom emoji support model
  - durable history with cursor pagination
  - edit/delete markers and strict access checks
- Initial implementation slice:
  - text-only skeleton first to validate core contracts
  - extensible message schema for future media/reaction features
- Realtime subscription model:
  - keep one socket connection per browser tab/session
  - switch channels by `chat:leave` old channel room and `chat:join` new channel room (no reconnect required)
  - optionally join `Community`-level room(s) to receive unread/activity signals for non-active channels
- History transport model:
  - use REST for message history loading (initial recent page + older cursor pagination)
  - use socket events for realtime message delivery and activity notifications
- Socket auth model:
  - use short-lived chat connection tokens for socket handshake auth
  - tokens are issued via REST after validating existing session auth
  - avoid direct long-term coupling of socket auth to session middleware internals
- Scaling direction:
  - stateless API/chat nodes
  - Socket.IO Redis adapter for cross-node fanout
  - shared session store for horizontal scaling
  - Postgres remains durable message source of truth
  - optional async event pipeline (Kafka/NATS/SQS-style) for side effects (notifications/analytics/moderation), not primary message durability

### D-014 Chat service extraction timing

- Status: accepted
- Decision:
  - defer extracting chat into a dedicated service/process for now
- Why:
  - current expected scale does not require immediate service separation
  - avoids adding distributed-systems complexity before core contracts/UX are stable
  - existing JWT socket-auth boundary keeps future extraction feasible without auth redesign
- Re-evaluation triggers:
  - sustained websocket load or p95 latency indicates API/chat contention
  - operational need for independent chat scaling/deploy cadence
  - team ownership boundaries make separate service operationally beneficial
- Future options:
  - keep modular monolith with horizontal scale + Redis
  - split to dedicated `apps/chat` service when triggers are met

### D-012 Chat socket auth decoupling strategy

- Status: accepted (for chat skeleton implementation)
- Decision:
  - use REST-issued chat connection token for Socket.IO authentication instead of directly relying on session-cookie parsing in the socket layer
- Why:
  - reduces auth coupling to current `apps/api` process internals
  - keeps a clean migration path to separate chat process/service if needed
  - gives explicit socket identity contract and easier boundary testing
- Tradeoffs:
  - adds one token-issuance call before socket connect
  - requires token lifecycle handling on the client
- Notes:
  - web session remains the root auth source for obtaining chat tokens
  - token TTL should be short enough to limit blast radius if exposed, while allowing seamless refresh in client code

### D-013 Chat channel switch and history loading pattern

- Status: accepted (for initial chat skeleton)
- Decision:
  - on channel switch, client leaves previous channel room and joins the new channel room over the existing socket
  - after join ack, client fetches recent history via REST (initial target page size: 25)
  - older history is fetched via cursor-based REST pagination while scrolling upward
- Why:
  - avoids expensive reconnect cycles and extra token churn when switching channels frequently
  - keeps durable history concerns in REST/DB path and realtime concerns in socket path
  - aligns with Discord-style UX expectations while keeping architecture simple
- Tradeoffs:
  - requires coordinating socket join/leave with REST history sync on frontend
  - unread/activity behavior for non-active channels needs separate event shape and state tracking
- Future options:
  - tune initial/history page sizes by performance metrics
  - prefetch/cache recent channel histories client-side for faster channel hopping
  - add push notification pipeline for offline mention/tag notifications

## Architecture notes by subsystem

### API (`apps/api`)

- Current module composition: auth, users, games, prisma, app core.
- Security middleware applied globally: rate limiting + CSRF.
- Current API responsibilities:
  - account auth/session lifecycle
  - profile read/update
  - bouncer lobby and level APIs
- Planned near-term additions:
  - chat module
  - account linking strategy
  - cleanup of temporary debug logs and UX polish

### Auth and identity

- Local credentials with hashed password verification.
- OAuth account records keyed by (`provider`, `providerAccountId`).
- Username auto-generation for OAuth-first accounts with collision handling.
- Session serializer stores user id and loads session user shape on request.

### Data model and persistence

- Current key entities: `User`, `OAuthAccount`, `Lobby`, `BouncerLevel`.
- User table is mapped to `account` db table (`@@map("account")`).
- Lobby includes metadata for game routing and lifecycle fields.
- Bouncer levels store JSON level definition plus visibility and owner constraints.

### Web frontend (`apps/web`)

- React SPA with central app routes and top navigation.
- Session-aware auth context and profile workflows.
- Game routes lazy-loaded to isolate heavy surfaces from core pages.
- Bouncer integration via package import (`@cup/bouncer-client`) and API-driven lobby join/create.

### Bouncer server/client/networking details

- Match orchestration:
  - each match has in-memory state and phase machine
  - sockets grouped by `matchId` room
  - creator/player roles influence controls (ready/start/score goal)
- Networking:
  - per-player state updates with sequence values
  - remote interpolation/extrapolation on client
  - server timestamp included on rebroadcast payload
- Runtime notes:
  - there is code for server-side simulation wrapper classes, but current match flow is primarily state-broadcast oriented
  - planned/possible evolution toward stronger authoritative simulation remains open

### Level editor

- Tool-based architecture (`PlatformTool`, `SpawnPointTool`, `PolygonTool`, `GoalTool`).
- Scene responsibilities split between editor scene and editor UI scene.
- Level format is shared via bouncer shared package types.
- Save/load integrated through API endpoints and authenticated user flows.

## Open questions / TBD areas

### Chat detailed schema and contracts (TBD)

- Final Prisma schema fields/indexes for `Community`, `Channel`, `ChannelMember`, `Message`.
- Final socket event payload contracts and ack/idempotency mechanics.
- Exact permission representation (`role` model vs resolved permission object) still open.

### Moderation and governance (TBD)

- Roles/admin/mod tools and mute/timeout lifecycle.
- Content moderation workflow and audit event model.

### Bouncer authoritative simulation path (TBD)

- Final decision on long-term authority model:
  - keep lightweight client-forwarded state model
  - or migrate to stronger server-authoritative pipeline
- If migrated, define reconciliation and correction protocol.

### Infrastructure evolution (TBD)

- Production deployment topology for API, web, bouncer server.
- Redis adoption sequencing (session store, Socket.IO adapter, distributed rate limits).
- Observability stack (metrics/logging/tracing/SLOs) and incident workflows.

## Change management guideline

When making a major architecture change, update this file with:

- Decision id/status
- What changed
- Why the change was chosen
- Tradeoffs introduced
- Migration/rollback notes (if relevant)
