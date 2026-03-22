---
description: Detailed implementation plan for Community + Chat (current state, locked decisions, and next milestones).
---

## Quick Notes:
redirect or restricted message when unauthed users access chat page.
Needed at community/MCCP level, as well as channel level.
Right now MCCP loads, and individual channels try to load, but 'loading messages...' message never goes away


## Scope
This document defines the implementation plan for community pages and channel-based chat.
In scope:
- Community read pages (`/communities/:slug`, `/communities/:slug/chat`)
- Channel list + chat layout shell
- Realtime connection/join/leave/send flow
- Message history API + cursor pagination
- Seeded development data and usage
Out of scope for now:
- Non-chat community features
- Full moderation tooling
- Attachments/media
- Rich notification center
- Full emoji/reaction UX (planned next phase)
## Naming and Core Model
Locked terminology:
- `Community` = optional container above channels
- `Channel` = chat surface users join and send messages in
- `Message` = durable chat message record
Design intent:
- One unified chat architecture across all chat surfaces
- Keep naming stable even if UI labels vary by context
## Current Implementation Status
### Backend (Implemented)
- `POST /api/chat/token` (session-authenticated) issues chat connection JWT.
- Socket.IO gateway at `/chat`.
- Handshake auth verifies JWT and stores:
  - `socket.data.userId`
  - `socket.data.authorDisplayName`
- Socket events implemented:
  - `chat:join` -> validates channel access, joins `channel:<channelId>`, emits `chat:join:ack`
  - `chat:leave` -> leaves room, clears active room when relevant, emits `chat:leave:ack`
  - `chat:send` -> validates payload, persists message, broadcasts `chat:message`, emits `chat:send:ack`
- Community read endpoints implemented:
  - `GET /api/communities/:slug`
  - `GET /api/communities/:slug/channels`
- History endpoint implemented:
  - `GET /api/chat/channels/:channelId/messages?limit&beforeCreatedAt&beforeId`
- History response now includes `authorDisplayName`.
### Frontend (Implemented)
- Community routes/pages:
  - `/communities/:slug`
  - `/communities/:slug/chat`
- Community chat page:
  - full-screen chat layout under topbar
  - channel list + chat panel
  - query-param channel selection (`?channel=<id>`)
- Chat feature components/hooks:
  - `MultiChannelChatPanel`
  - `ChannelList`
  - `ChannelChatView`
  - `MessageRow` (memoized)
  - `ChatComposer`
  - `useChatConnection`
  - `useChannelRoom`
  - `useChatMessaging`
- `useChatMessaging` currently supports:
  - history fetch on channel/connection
  - realtime message listener
  - `sendMessage` with `chat:send:ack` timeout handling
- Auto-scroll to bottom on new messages is implemented.
- `apps/web/src/api/chat.ts` includes:
  - token fetch
  - socket connect helper
  - join/leave helpers
  - message history helper
### Data Layer (Implemented)
Prisma models:
- `Community`
- `CommunityMember`
- `Channel`
- `ChannelMember`
- `Message`
Seed data:
- users, communities, channels, memberships, messages
- seeded community includes `description`
## Realtime and History Architecture
### Socket Strategy (Current)
- One socket connection per tab/session.
- Switch channels via `leave old` + `join new` on same socket.
- Room naming: `channel:<channelId>`.
### REST vs Socket Responsibilities (Locked)
- REST: durable history + pagination.
- Socket: realtime delivery + join/leave/send/ack.
### Access Control
Current policy:
- `chat:join` enforces visibility/membership via service access check.
- `chat:send` currently uses room/active-room checks and authenticated socket metadata.
- This is intentionally optimized for current phase; future hardening can reintroduce send-time DB access validation if needed.
## Pagination Strategy (Locked)
Cursor:
- `beforeCreatedAt`
- `beforeId`
- `limit` (default 25)
Server query:
- `where channelId = ?`
- and `(createdAt < beforeCreatedAt OR (createdAt = beforeCreatedAt AND id < beforeId))`
- `orderBy createdAt DESC, id DESC`
- `take limit + 1`
Client behavior:
- History helper normalizes list to ascending display order.
- Realtime messages append to end.
## Routes and Contracts
### Backend APIs
- `GET /api/communities/:slug` (implemented)
- `GET /api/communities/:slug/channels` (implemented)
- `GET /api/chat/channels/:channelId/messages` (implemented)
- `POST /api/chat/token` (implemented)
### Socket Events
Client -> server:
- `chat:join`
- `chat:leave`
- `chat:send`
Server -> client:
- `chat:join:ack`
- `chat:leave:ack`
- `chat:send:ack`
- `chat:message`
- `chat:error`
## Testing Status
Implemented:
- `apps/api/src/chat/chat.gateway.spec.ts` with meaningful gateway behavior coverage (join/leave/send/auth/ack/broadcast/validation flows).
Still needed:
- integration tests for history pagination edge cases and access filtering
- frontend integration/e2e smoke for send/receive/channel-switch
## Remaining Core Work (Next)
1. Load older messages on scroll-up
   - add `loadOlderMessages` in `useChatMessaging`
   - preserve scroll position while prepending older messages
   - dedupe by message id
2. Disconnect/reconnect UX hardening
   - define reconnect strategy (manual refresh vs automatic backoff)
   - ensure channel rejoin and history refresh after reconnect
3. Send UX hardening
   - robust pending/failure handling in composer
   - clear sending state in error paths
   - optional optimistic message pipeline using `clientMessageId`
4. Message ordering + dedupe hardening
   - centralize merge helpers for history/realtime
   - avoid duplicates on overlap and reconnect windows
## Planned Feature Track (Post-Baseline Chat)
### Reactions
- DB model: `MessageReaction` (`messageId`, `userId`, `emoji`, timestamps)
- Socket events:
  - `chat:reaction:add`
  - `chat:reaction:remove`
  - room broadcast updates
- UI:
  - reaction bar per message
  - counts + user-has-reacted state
- Suggested approach:
  - idempotent upsert/remove semantics
  - aggregate counts server-side for history payloads
### Emoji
- Start with Unicode emoji picker in composer.
- Keep payload as plain message body first.
- Later:
  - shortcode parsing (`:wave:`) optional
  - custom emoji catalog model (deferred)
### Scroll-based History Loading
- Trigger older load near top threshold.
- Preserve viewport position after prepend.
- Guard against duplicate concurrent loads.
### Notifications (Incremental)
- Phase 1:
  - unread indicator per channel while not active
- Phase 2:
  - mention/ping detection
  - lightweight in-app notification badges
- Phase 3:
  - persisted notification feed/preferences
## Post-Chat TODO (Queued)
After core chat is stable:
- Profile tabs:
  - `Profile`
  - `Communities`
- Communities tab should show:
  - community name
  - link to `/communities/:slug`
  - membership metadata (`joinedAt`, `primaryRole`)
## Architecture Evolution Triggers
Current decision: keep chat in `apps/api`.
Re-evaluate extraction when:
- websocket/API contention impacts latency
- independent scaling/deploy cadence becomes necessary
- team ownership boundaries justify split
Future scale path:
- Socket.IO Redis adapter
- shared Redis session/presence infrastructure
- distributed rate limits/activity caches
---




NOTE: EMOJI CSS/LAYOUT:

<article class="px-1 py-0.5"><div class="mb-0.5 flex items-baseline gap-2"><span class="text-base font-semibold text-slate-300">Jung</span><span class="text-[11px] text-[color:var(--muted)]">8:57 AM</span></div><span>w elkajf wajef aeoi;gwaoiejg oiwaejgi owajeoi;g jwaoiej goiawejai;f wlkej flajw ekfjwalej fwae f END OF SPAN1</span><span style="
    /* font-size: 2em; */
    /* width: 1.35em; */
    /* max-width: 1em; */
    overflow: none;
    display: inline-block;
"><img src="/games/bouncer/ball_green.png" style="
    height: 1.35em;
    width: 1.35em;
    display: inline;
    margin: 0 5px;
">
</span><span>wlej faweng;awneo; gawjoej fiaeio;g oi;awerhgi ;wajeai gjwaeg
</span></article>