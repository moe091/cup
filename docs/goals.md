---
description: Multiplayer minigame platform with physics racing and social features.
---

## Product vision

A social web platform for friends to hang out and play quick, casual multiplayer minigames. Focus on clean and 'comfy' UI. Aim to feel more like a 'hangout spot' than a website by integrating friends and social features into everything - e.g. seamlessly add friends to games and chats, form groups/parties to do activities together, and even show friends/party-members avatars on pages so you can visually run into friends who are on the same page, making it feel like a real 'world'.

## Core user goals

- **Quick play**: Start a game instantly or join friends in seconds.
- **Social**: Lobbies, friend invites, public/private level sharing.
- **Environment**: Make it feel more like a 'place' than a website by seamlessly integrating social features and treating web pages like gathering places.

## UX principles

- **Minimal friction**: Few steps to start playing.
- **Clear feedback**: Visual + text cues for all actions.
- **Responsive on web and mobile**.
- **Juice**: Borrow the game dev concept of "juiciness" to make all user interactions satisfying and full of feedback

---

## Subproject breakdown

### API (apps/api)

- NestJS backend for users, lobbies, scores, level storage.
- PostgreSQL + Prisma.

### Frontend (apps/web)

- React SPA, minimal UI, game selector routing.
- Auth via Passport, sessions.

### Bouncer game (games/bouncer/)

#### Engine

- planck.js box2d physics.
- Deterministic: inputs → same outputs.
- Designed to easily support client-side prediction(currently engine only runs on server)

#### Server

- Room/match management via Socket.IO.
- Own Engine instance per lobby.
- 1 server instance for all bouncer games, server instance creates Socket.IO rooms for each lobby(and a 'Match' instance)

#### Client

- Phaser visual renderer.
- Handles user input, sends to server.
- Also includes level editor

#### Shared (types)

- Game-specific level/data types.


### Future games

#### gif'tionary

- like pictionary but users can use giphy or klipy gifs to find images that represent a theme word
- also includes other clues like if it's a verb/noun/adjective/etc. Maybe word length and specific letter clues if it's taking too long
- 1 user is the presenter and others are guessers for each round. 
  - presenters get points based on how quickly their theme is guessed, guessers get points based on how quickly they guess each theme


#### wikipedia race

- Everyone starts with the same page and has to race to a target page only by clicking links in the wikipedia pages
- can be first one to finish wins, or least number of clicks wins(with a time limit, perhaps 20s after first person finishes)
---

## Development workflow

- `pnpm run dev` for local hot‑reload.
- End of feature → `lint`, `typecheck`, `test` before commit.
- CI runs same checks on PR.

---

## Current TODO priorities

### Users / Accounts

- Replace remaining `alert(...)` auth/profile errors with inline or toast UI feedback.
- Remove auth/debug `console.log` output from backend controllers.
- Decide and implement account linking strategy for local + Google + Discord accounts.
- Polish topbar identity fallback behavior when `displayName` is missing.
- Add integration/e2e coverage for signup/login/logout, OAuth callbacks, and profile updates.
- Improve unauthenticated `/profile` redirect/UX behavior.
- Add email verification + password reset flows (post-v1 hardening).

### Chat Rooms

- Use one modular chat system with a unified `Channel` model and `kind` (`dm`, `meeting`, `room`, `guild_channel`, `game_page`).
- Build one reusable frontend chat component that takes `channelId` and can be embedded on profile rooms, guild halls, game pages, and DM views.
- Use one realtime chat gateway/service with Socket.IO rooms keyed by `channelId` (do not spin up one server per chat).
- Persist all messages in a shared `Message` table keyed by `channelId` (no per-chat tables), with strong indexing and cursor pagination.
- Enforce access via membership/policy checks on every read/send/subscription action.
- Start with simple permissions by channel kind; evolve to role-based permission overrides later.
- Keep chat history durable and queryable (recent messages + older pagination) for all chat surfaces.
- Plan now for future scale: stateless gateway nodes + Redis adapter + DB indexing/retention strategy.

#### Chat Terminology and hierarchy (working)

- `Channel` is the primary unit for messaging and realtime delivery.
- `channelId` replaces `conversationId` across frontend, backend, sockets, and DB references.
- Add one optional `Community` layer above channels for multi-channel spaces (Discord-like server equivalent).
- A community can hold many channels (example: a guild hall has one community with multiple channels).
- Standalone surfaces (for example DMs and some game-page chat) can be single channels with no container.
- UI labels can vary by context later; keep internal model naming stable as `Community` + `Channel`.

#### Chat Rooms TODO (Phase 1)

- Define Prisma schema for `Community`, `Channel`, `ChannelMember`, `Message`, and basic policy fields.
- Implement chat backend REST + socket contract (join, leave, send, ack, fetch history).
- Add server-side authorization checks for `canView` and `canPost` per channel kind.
- Implement frontend chat component with message list, composer, optimistic send, and history pagination.
- Embed the component first in one surface (recommended: user room chat) to validate contracts before rolling out everywhere.
- Add moderation/event fields (`editedAt`, `deletedAt`, `system` messages) even if UI support is minimal at first.
- Add integration tests for auth + permissions + realtime delivery + history consistency.

#### Chat Rooms Requirements (Locked for v1)

- Keep one unified chat architecture (shared `Community`, `Channel`, `ChannelMember`, `Message`) and one reusable embeddable chat UI across all surfaces.
- Ship v1 with plain text messaging plus rich media support:
  - Embedded images shown as bounded thumbnails in the message list.
  - Click image thumbnail to open full-size media view.
  - GIF support as first-class media content.
- Ship v1 with emoji support in messages and reactions:
  - Standard emoji support everywhere chat is available.
  - Reactions supported on messages.
  - Any emoji usable in message body and as a reaction.
- Plan custom emoji support in the core model from the start, with both ownership modes:
  - User-owned custom emoji (earned/unlocked by user, usable by that user across chats).
  - Context-owned custom emoji (earned/unlocked by room/guild/chat context, usable by members in that context).
- Align interaction design closely with Discord-style chat UX while preserving product visual identity.
- Delivery approach can be incremental in implementation order (for example: plain text first, then media, then emoji/reactions), but the v1 target scope includes all features above.

#### Chat Rooms Functional decisions (current)

- Access mode starts simple: channels are either `public` or `private`.
- Membership source must support mixed modes:
  - direct/manual allow-list members
  - derived membership (for example from guild membership or friend relationships)
- Access semantics: users with access to a channel can view its history.
- Moderation controls such as mute are expected later, but moderation/admin features are deferred for now.
- Message author controls in v1:
  - users can edit their own messages
  - users can delete their own messages
  - deleted messages render with a `[deleted]` marker
  - edited messages render with an `[edited]` marker
- History and pagination:
  - durable history with no expiry policy initially
  - initial history load target: latest 25 messages on channel open/join
  - incremental older-history fetch via cursor as user scrolls upward (page size can be tuned; start with 25)
- Realtime delivery and UX behavior:
  - server-broadcast message remains source of truth for displayed messages
  - client uses send timeout (around 10 seconds) to mark unsent/failed state and offer resend
  - duplicate-send prevention strategy is required (details to finalize during implementation design)
  - broadcast payload should include server timestamp for deterministic ordering when events arrive out of order
- Presence/read features:
  - typing indicators deferred
  - read receipts out of scope
  - push notifications and tag/mention notifications while offline are deferred until basic chat is stable
- Attachment/media support planning:
  - start implementation with text-only message flow
  - keep message contracts extensible so attachments can be added without architectural churn
  - attachment rendering and transport details will be finalized in the media feature phase

#### Chat skeleton implementation plan (text-only first)

- Goal: deliver one minimal end-to-end chat slice proving core architecture (persisted history + realtime send/receive + auth checks) before advanced features.
- Data layer first:
  - introduce `Community`, `Channel`, `ChannelMember`, and durable `Message` models
  - include base fields now for future compatibility (`editedAt`, `deletedAt`, timestamps, authorId, channelId)
- Backend contracts (minimal):
  - REST: fetch latest messages and paginated older history by cursor (history transport)
  - REST: issue short-lived chat connection token from authenticated web session
  - Socket: join channel, leave channel, send message, message ack/new-message events
  - auth: enforce channel access checks for both history fetch and socket actions
- Socket auth model (selected):
  - do not bind socket auth directly to session cookie middleware
  - use a dedicated chat token presented during socket handshake
  - token is issued by API after validating existing session auth
  - token is for connection authentication (handshake), not a long-lived replacement for web session
  - prefer short token TTL (for example 5-15 minutes) with transparent re-issue on reconnect
  - design goal: reduce coupling so chat can be split into its own process/service later with minimal auth redesign
- Realtime send behavior (initial):
  - client sends message payload and waits for server ack/new-message before rendering as delivered
  - if ack not received in timeout window, mark as failed and allow resend
  - include server timestamp and stable ids in broadcast payloads to support deterministic ordering
- Frontend component shape (initial):
  - reusable `ChatPanel` root component keyed by `channelId`
  - message list + composer + incremental upward pagination
  - avoid full-list re-renders by appending/prepending in state slices keyed by `channelId`
  - channel switch flow: leave old channel room, join new channel room, then fetch recent channel history over REST
  - keep one socket connection per browser tab/session (do not open one socket per channel)
  - join optional `Community`-level room(s) for channel activity/unread notification events
- Initial rollout scope:
  - embed in one surface first to validate contracts and UX behavior
  - defer typing indicators, read receipts, moderation tooling, and rich media UI until base slice is stable

#### Chat deployment and scaling strategy (current)

- Implementation location:
  - backend chat module lives inside `apps/api` initially (`ChatModule` with REST + Socket.IO gateway)
  - frontend chat feature lives inside `apps/web` initially (reusable `ChatPanel` and related hooks/components)
  - shared chat contracts/types should live in shared package space for both api and web consumption
- Reason for initial placement:
  - reuses existing session auth/cookie flow with minimal integration risk
  - keeps permission logic centralized with existing domain services
  - reduces early infrastructure complexity while feature contracts are still evolving
- Long-term scale direction:
  - move to stateless API/chat nodes
  - add Redis adapter for Socket.IO pub/sub fanout across nodes
  - use shared session store so auth/session works across horizontally scaled instances
  - keep room/channel state ephemeral in memory per node; keep durable source of truth in Postgres
- Architectural guardrail:
  - design chat module boundaries so service extraction is possible later if needed, but avoid premature split into a separate `apps/chat` service now
- Current re-evaluation note:
  - explicit decision: defer splitting chat into a dedicated service for now
  - reason: current scale does not require it yet, and keeping chat in `apps/api` avoids premature distributed-systems complexity while contracts stabilize
  - re-evaluate extraction after core chat is stable and real performance/operational signals justify it
- Future optimization options (as needed):
  - Redis adapter for Socket.IO fanout across multiple nodes
  - Redis-backed shared session store for horizontally scaled auth/session
  - Redis-backed distributed rate limiting and short-lived presence/activity caches
  - async event pipeline (Kafka/NATS/SQS-style) for non-critical side effects such as notifications, analytics, and moderation workflows
  - optional dedicated chat service/process once load, team boundaries, or ops requirements justify the split
- Deployment/config TODO:
  - before production rollout, update `CORS_ALLOWED_ORIGINS` and provider callback/base-domain env values from placeholder domains to real deployed domains


---
