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

- Use one modular chat system with a unified `Conversation` model and `kind` (`dm`, `meeting`, `room`, `guild_channel`, `game_page`).
- Build one reusable frontend chat component that takes `conversationId` and can be embedded on profile rooms, guild halls, game pages, and DM views.
- Use one realtime chat gateway/service with Socket.IO rooms keyed by `conversationId` (do not spin up one server per chat).
- Persist all messages in a shared `Message` table keyed by `conversationId` (no per-chat tables), with strong indexing and cursor pagination.
- Enforce access via membership/policy checks on every read/send/subscription action.
- Start with simple permissions by conversation kind; evolve to role-based permission overrides later.
- Keep chat history durable and queryable (recent messages + older pagination) for all chat surfaces.
- Plan now for future scale: stateless gateway nodes + Redis adapter + DB indexing/retention strategy.

#### Chat Rooms TODO (Phase 1)

- Define Prisma schema for `Conversation`, `ConversationMember`, `Message`, and basic policy fields.
- Implement chat backend REST + socket contract (join, leave, send, ack, fetch history).
- Add server-side authorization checks for `canView` and `canPost` per conversation kind.
- Implement frontend chat component with message list, composer, optimistic send, and history pagination.
- Embed the component first in one surface (recommended: user room chat) to validate contracts before rolling out everywhere.
- Add moderation/event fields (`editedAt`, `deletedAt`, `system` messages) even if UI support is minimal at first.
- Add integration tests for auth + permissions + realtime delivery + history consistency.


---
