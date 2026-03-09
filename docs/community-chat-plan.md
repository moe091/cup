---
description: Detailed implementation plan for Community + Chat (current state, locked decisions, and next milestones).
---

## Scope

This document defines the implementation plan for community pages and channel-based chat.

In scope:

- Community read pages (`/communities/:slug`, `/communities/:slug/chat`)
- Channel list + chat layout shell
- Realtime connection/join/leave flow
- Message history API + pagination strategy
- Seeded development data and usage

Out of scope for now:

- Non-chat community features
- Full moderation tooling
- Replies, emoji/reactions, notifications, attachments (tracked as future-ready)

## Naming and Core Model

Locked terminology:

- `Community` = optional container above channels.
- `Channel` = chat surface users join and send messages in.
- `Message` = durable chat message record.

Design intent:

- One unified chat architecture across all chat surfaces.
- Keep internal naming stable even if UI labels vary later by context.

## Current Implementation Status

### Backend (Implemented)

- `POST /api/chat/token` (session-authenticated) issues chat connection JWT.
- Socket.IO gateway at namespace `/chat`.
- Handshake auth verifies JWT and stores `socket.data.userId`.
- Socket events implemented:
  - `chat:join` -> joins room `channel:<channelId>`, emits `chat:join:ack`
  - `chat:leave` -> leaves room `channel:<channelId>`, emits `chat:leave:ack`
- Community read endpoints implemented:
  - `GET /api/communities/:slug`
  - `GET /api/communities/:slug/channels`
- Community summary now includes `description` in schema, seed data, and API response DTO.

### Frontend (Implemented)

- `apps/web/src/api/chat.ts` helpers:
  - `fetchChatToken()`
  - `createChatSocket()`
  - `connectToChat()`
  - `joinChannel()` / `leaveChannel()`
- Debug route `GET /chat-test`:
  - connect/disconnect
  - join/leave by channel id
  - logs ack/error/connection events
- Community base page implemented at `/communities/:slug`:
  - fetches community summary from API
  - renders name, owner, description, created date, channel count
  - links to `/communities/:slug/chat`

### Data Layer (Implemented)

Prisma models added and migrated:

- `Community`
- `CommunityMember`
- `Channel`
- `ChannelMember`
- `Message`

Seed data files added:

- `apps/api/prisma/seed-data/userSeed.json`
- `apps/api/prisma/seed-data/chat/communitySeed.json`
- `apps/api/prisma/seed-data/chat/channelSeed.json`
- `apps/api/prisma/seed-data/chat/communityMemberSeed.json`
- `apps/api/prisma/seed-data/chat/channelMemberSeed.json`
- `apps/api/prisma/seed-data/chat/messageSeed.json`

Seed script currently loads and upserts users, bouncer levels, and chat entities.

## Schema Rationale (Why it is designed this way)

### Community

- Holds multi-channel spaces (Discord-server-like behavior).
- `slug` enables URL routing.
- `ownerUserId` supports ownership + future admin policy.

### Channel

- Nullable `communityId` supports both:
  - community-bound channels
  - standalone channels (DM/game-page)
- `kind` supports domain-level behavior flags.
- `visibility` supports current public/private model.

### Membership Join Tables

- `CommunityMember` and `ChannelMember` use composite PKs for uniqueness.
- `ChannelMember.source` (`MANUAL`/`DERIVED`) supports mixed membership strategy.

### Message

- Global unique `id` for references/links/replies later.
- `channelId` and `authorUserId` FKs.
- `createdAt`, `editedAt`, `deletedAt` for lifecycle markers.
- Index `(channelId, createdAt, id)` supports cursor pagination by time + tie-breaker.

## Realtime and History Architecture

### Socket Strategy (Locked)

- One socket connection per browser tab/session.
- Do not open one socket per channel.
- Switch channels via `leave old` + `join new` over existing socket.
- Room naming pattern: `channel:<channelId>`.

### Community Activity Subscription (Planned)

- Add optional community-level room subscription later for unread/activity events.
- Goal: highlight channels with new activity without joining all channels.

### REST vs Socket Responsibilities (Locked)

- REST: durable history loading and pagination.
- Socket: realtime delivery, join/leave/send acknowledgments, activity signals.

## Auth and Security Model

- Web session remains root identity/auth source.
- Client obtains short-lived chat token via `POST /api/chat/token`.
- Socket handshake uses token (`auth.token`) and validates:
  - signature
  - `audience: chat`
  - `issuer: cup-api`
- CSRF applies to token issuance route (POST), and frontend uses `buildCsrfHeaders()`.

## Pagination Strategy (Locked)

Cursor shape:

- `beforeCreatedAt`
- `beforeId`
- `limit` (initial default target: 25)

Why both timestamp and id:

- Multiple messages can realistically share identical timestamps (millisecond collisions under load or close sends).
- `beforeCreatedAt` alone can skip/duplicate rows when timestamps tie.
- `beforeId` is deterministic tie-breaker for stable pagination order.

Query shape (conceptual):

- where `channelId = ?`
- and `(createdAt < beforeCreatedAt OR (createdAt = beforeCreatedAt AND id < beforeId))`
- order by `createdAt DESC, id DESC`
- take `limit`

## Route and Contract Plan

### URL Naming (Locked)

- Use plural resource naming:
  - `/communities/:slug`
  - `/communities/:slug/chat`

### Backend APIs (Next)

1. `GET /api/communities/:slug` (Implemented)
   - Returns basic community data for base community page.

   Current fields:
   - `id`, `name`, `description`, `slug`
   - `ownerUserId`, `ownerDisplayName`
   - `createdAt`, `channelCount`

2. `GET /api/communities/:slug/channels` (Implemented)
   - Returns channels for sidebar render.
   - Private channels hidden unless requester is member.

   Proposed fields per channel:
   - `id`, `name`, `kind`, `visibility`, `createdAt`

3. `GET /api/chat/channels/:channelId/messages` (Next)
   - Query: `limit`, `beforeCreatedAt`, `beforeId`
   - Returns most recent page or older cursor page.

## Frontend Implementation Plan

### Phase 1: Skeleton UI (Next)

1. Add routes:
   - `/communities/:slug`
   - `/communities/:slug/chat`
2. Community base page:
   - render community name/owner/details from API
   - link to `/communities/:slug/chat`
3. Chat page placeholder layout:
   - left sidebar: real channel names from API
   - main message panel: blank placeholder area
   - composer footer: textarea + send button (disabled/non-functional initially)

Progress note:

- `/communities/:slug` route/page is implemented.
- `/communities/:slug/chat` skeleton is the immediate next frontend step.

### Phase 2: Real Data + State Wiring

- Channel selection state with URL support:
  - use `?channel=<channelId>` when present
  - fallback to first accessible channel
- On channel change:
  - leave previous channel room
  - join new channel room
  - fetch latest 25 messages via REST

### Phase 3: Send + Realtime Rendering

- Implement `chat:send` backend and persistence.
- Render pending outgoing message immediately as faded.
- On server ack/new-message:
  - reconcile pending item
  - transition to normal opacity (finalized)

## Seed Data and Local Flow

### Existing Seed Data

- Three login-capable users:
  - `Jung1`, `Freud2`, `Adler3`
- One seeded community with seeded channels/members/messages.

### Seed Modes

- `seed:dev`, `seed:test`, `seed:base` exist.
- Current behavior:
  - `dev` and `test` both load current full seed set
  - `base` skips user/chat seed data
- Future plan:
  - design dedicated minimal test fixtures when writing real chat tests

## Testing Plan (Chat)

### Near-term

- Add integration tests for community/channel read endpoints.
- Add integration tests for history pagination correctness.
- Add integration tests for channel visibility filtering (public/private membership).

### Later

- Add socket integration tests for join/leave/send/ack behavior.
- Add browser E2E chat smoke flow after chat UI reaches functional baseline.

## Deferred Features (Future-ready)

Design should remain compatible with:

- replies/threading via `replyToMessageId`
- emoji and reactions
- custom emoji ownership (user-owned and context-owned)
- rich attachments (image/GIF)
- mentions/pings and notification pipeline
- moderation/admin controls (mute/timeout/delete)

## Architecture Evolution Triggers

Current decision: keep chat in `apps/api`.

Re-evaluate extraction into dedicated service when:

- sustained websocket/API contention appears in latency/throughput metrics
- independent scaling/deploy cadence becomes operationally necessary
- team ownership boundaries justify service split

Redis-related scale path (future):

- Socket.IO Redis adapter for multi-node fanout
- shared Redis session store
- distributed rate limits and ephemeral presence/activity caches

## Milestone Backlog

1. Implement community read backend endpoints. (Completed)
2. Implement community base page route + data fetch. (Completed)
3. Implement chat page placeholder shell + channel list. (Next)
4. Implement history endpoint with cursor pagination.
5. Wire channel switching join/leave + history load.
6. Implement send + pending/finalized message UX.
7. Add integration tests for read/history/access behavior.

## Post-Chat TODO (Queued)

After core chat baseline is complete (items 3-7 above), implement profile-page tab expansion:

- Add tabs to profile container, starting with:
  - `Profile` (existing content)
  - `Communities`
- `Communities` tab should list communities the user is in, with:
  - community name
  - link to `/communities/:slug`
  - membership metadata (`joinedAt`, `primaryRole`)
- Keep this scoped as a lightweight UX enhancement after chat core is stable.
