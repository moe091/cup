---
description: Current implementation plan for emoji support in chat (composer-first, production-minded, incremental).
---

## Goal

Implement emoji support in chat incrementally with strict TypeScript contracts and minimal architecture churn:

- Standard emoji (Unicode) should work naturally everywhere.
- Custom emoji should use stable ids and render as inline images.
- Composer should support inserting and previewing emoji while typing.
- Message wire/storage format should remain plain text, not HTML.


## Locked Decisions

- Message body remains plain text in DB and over socket/REST.
- Standard emoji are stored as Unicode characters in `Message.body`.
- Custom emoji use token format `<:name:id>`.
- `id` is the canonical key; `name` is human-readable.
- Custom emoji id format: short opaque string (recommended `nanoid(10)`).
- Emoji scopes: `GLOBAL | COMMUNITY | USER`.
- `USER` emojis are owner-only usage in v1.
- `deletedAt` soft-delete is used for custom emoji.
- Deleted emoji rendering fallback: `[deleted emoji]`.
- Emoji loading context is based on `communityId` (not route slug). If `communityId` is `null`, catalog should include only `GLOBAL` + current user's `USER` emojis.


## Non-Goals (for this implementation slice)

- Full paid-tier friend-emoji usage rules (planned extension).
- Unicode emoji replacement with OpenMoji assets (deferred follow-up).
- Full moderation/admin panel for emoji lifecycle.


## Core Data Model

Proposed `CustomEmoji` model fields:

- `id: string` (global unique id, token key)
- `name: string` (shortcode-friendly display name)
- `scopeType: "GLOBAL" | "COMMUNITY" | "USER"`
- `scopeId: string | null` (`null` only for `GLOBAL`)
- `assetKey` or `assetUrl: string`
- `createdByUserId: string`
- `deletedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

Constraints/indexing:

- Unique name per scope for active emojis.
- Fast lookup by `id` for send-time validation and rendering resolution.
- Soft-deleted rows retained for historical message fallback behavior.


## Message and Rendering Model

### Canonical Message Format

- Standard emoji: Unicode directly in text.
- Custom emoji: inline token in text (`<:name:id>`).

### Rendering Rules

- Renderer parses message body into segments.
- Custom emoji token segments render as inline image nodes.
- Standard Unicode remains native-rendered for now.
- If emoji id is missing/deleted/unresolvable, render `[deleted emoji]`.

### Why plain text canonical format

- Keeps transport/storage simple and safe.
- Preserves copy/paste portability.
- Avoids storing HTML and related sanitization complexity.
- Keeps OpenMoji replacement optional as a view-layer enhancement.


## Composer Strategy (First Implementation Target)

Composer remains `contentEditable`, but with explicit serialization before send:

- Standard emoji insertion: insert Unicode at caret.
- Custom emoji insertion: insert non-editable emoji chip in editor DOM.
- Each custom emoji chip includes token metadata (for serialization):
  - e.g. `data-emoji-token="<:name:id>"`
- On send, serialize editor DOM to canonical plain text body:
  - text nodes -> text
  - custom chips -> token string
  - line breaks -> `\n`

Key rule:

- Never send or store HTML from composer.


## Backend Validation Strategy

Validate custom emoji usage at send-time, with batched lookup:

1. Parse unique custom emoji ids from message body.
2. Resolve metadata in batch (`IN (...)`) using cache + DB fallback.
3. Apply policy checks by scope:
   - `GLOBAL`: allowed
   - `COMMUNITY`: allowed based on channel/community access
   - `USER`: allowed if owner is sender (v1)
4. If invalid/unauthorized emoji is present, reject the message with a clear error.

Future extension (planned):

- Extend USER policy to allow paid users to use friends' emojis.
- This should be implemented by extending centralized policy checks, not changing token format.


## Caching Strategy

Avoid per-emoji DB lookups in hot paths:

- Client caches emoji catalog for picker/rendering.
- Server caches emoji metadata by id for send validation.
- Unknown ids are resolved in batch.
- Emoji updates/deletions can invalidate cache via versioning or socket event later.

## Storage Notes

- Current local/dev seed assets can live under `apps/web/public/chat/emojis`.
- Production/user-uploaded emoji assets should be migrated to object storage (S3-compatible) and served via CDN.
- DB should keep stable asset pointers (`assetKey`/`assetUrl`) so storage backend can change without message/token format changes.


## API Plan (Incremental)

Initial read-focused endpoints:

- `GET /api/emojis/catalog?communityId=<id>` (implemented)
  - Returns emojis usable in current context:
    - `GLOBAL`
    - current `COMMUNITY`
    - current user's `USER` emojis

Potential follow-up endpoint (for resolver misses):

- `GET /api/emojis/resolve?ids=<id1,id2,...>` (implemented)

Upload/manage endpoints are intentionally out of this first build slice.


## Current Implementation Status

Implemented so far:

- Shared emoji contracts in `packages/shared/src/emoji.ts`.
- Prisma `CustomEmoji` model + migration + generated Prisma client updates.
- Seed data for current local emoji assets in `apps/web/public/chat/emojis`.
- API endpoint: `GET /api/emojis/catalog` with optional `communityId`.
- Frontend API helper: `fetchEmojiCatalog` in `apps/web/src/api/emojis.ts`.
- Frontend API helper: `fetchResolvedEmojisByIds` in `apps/web/src/api/emojis.ts`.
- Frontend emoji catalog hook: `useEmojiCatalog` with cache-by-community-key and TTL.
- Community context wiring to composer:
  - `CommunityChatPage` resolves `communityId`
  - `MultiChannelChatPanel` forwards `communityId`
  - `ChannelChatView` forwards `communityId`
  - `ChatComposer` loads catalog via `useEmojiCatalog`
- Emoji picker UI in composer (standard + custom sections, close-on-select, Shift-click keep-open).
- Composer insertion handlers for Unicode/custom emoji tokens.
- Composer inline rendering for:
  - larger Unicode emojis
  - custom emoji chips (`contenteditable=false`) with token serialization
- Message-row rendering for:
  - larger Unicode emojis
  - custom emoji inline images via token resolution
  - unresolved/deleted fallback `[deleted emoji]`
- Frontend token-resolution cache/hook:
  - `useResolvedCustomEmojiMap` resolves unknown ids in batch
  - caches resolved ids and unresolved/deleted ids to avoid repeated lookups

Not implemented yet:

- Backend/server cache layer for send-time emoji validation metadata.


## Implementation Checklist

### Phase 1 - Shared and Backend Foundation

- [x] Add shared emoji DTO/types in `packages/shared`.
- [x] Add Prisma model + migration for `CustomEmoji`.
- [x] Add API service/controller for emoji catalog read.
- [x] Seed minimal data for emoji testing.

### Phase 2 - Composer Emoji Support (First UI Milestone)

- [x] Add emoji picker UI shell in `ChatComposer`.
- [x] Implement standard Unicode emoji insertion at caret.
- [x] Implement custom emoji chip insertion at caret.
- [x] Implement robust DOM serialization to canonical plain text.
- [x] Preserve existing Enter/Shift+Enter/IME behavior.
- [x] Preserve plain-text paste behavior.

Phase 2 pre-work completed:

- [x] Load emoji catalog in `ChatComposer` through `useEmojiCatalog`.
- [x] Add community-context prop wiring (`communityId`) to chat component chain.

### Phase 3 - Send Path Validation

- [x] Parse custom tokens server-side on `chat:send`.
- [ ] Resolve metadata in batch with caching.
- [x] Enforce scope policy and reject invalid message payloads.
- [x] Add targeted gateway/service tests for validation behavior.

### Phase 4 - Message Rendering

- [x] Parse message body into render parts in frontend.
- [x] Render custom emoji tokens as inline images.
- [x] Render unresolved/deleted tokens as `[deleted emoji]`.
- [ ] Keep Unicode native rendering unchanged.

### Phase 4.5 - Resolve Path and Caching

- [x] Add resolver endpoint for unknown custom emoji ids (`GET /api/emojis/resolve`).
- [x] Resolve unknown ids in batch on frontend render path.
- [x] Cache resolved ids and unresolved/deleted ids client-side.

### Phase 5 - Hardening and Follow-ups

- [ ] Improve deletion/update cache invalidation strategy.
- [ ] Add OpenMoji replacement pass for standard Unicode emoji (optional follow-up).
- [ ] Add paid-tier/friends user-emoji authorization extension.


## Risks and Mitigations

- `contentEditable` caret and selection edge cases:
  - isolate insertion/serialization helpers and test with long multi-line messages.
- IME/composition issues:
  - keep composition guard in key handling.
- Token parsing correctness:
  - centralize parser and unit test malformed/partial token edge cases.
- Unauthorized token spam:
  - reject with clear error; keep parser/lookup bounded and batched.


## Notes for Ongoing Work

- Keep implementation incremental and avoid broad refactors.
- Preserve current chat architecture unless a clear technical need emerges.
- Prefer pure helper functions for parser/serializer logic for easier unit testing.
- Keep all emoji-related user-facing behavior deterministic and debuggable.
