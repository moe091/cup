---
description: Current progress and remaining implementation plan for chat UX features (message action menu, reactions, replies, and grouped messages).
---

## Goal

Deliver Discord-style chat ergonomics incrementally with strict TS contracts and production-minded behavior:

- Hover/focus message action menu
- Reactions (quick + picker + realtime)
- Replies (composer state + preview + jump)
- Grouped message rendering for readability

## Known Follow-up Debt

- Add user-visible error feedback for failed reaction toggles (currently silent TODO paths in row actions).
- Add in-flight reaction mutation guards to reduce rapid-toggle race UX.
- Implement "show more reactors" API + UI pagination for full reactor lists.
- Add optional lazy fetch for reply targets not present in current history window.
- Add frontend tests for reply/reaction/grouping interaction flows.


## Current Status

### Completed

- Message row hover/focus highlight implemented.
- `MessageActionMenu` implemented with quick react, open picker, and reply controls.
- Anchored emoji picker implemented for message-row actions.
- Anchored picker bottom overflow handling improved to keep picker full-height by shifting upward.
- Action menu focus bug fixed (menu now hides correctly after click + mouse leave).
- Reactions backend implemented:
  - `MessageReaction` schema + migration
  - socket event `chat:reaction:set`
  - realtime broadcast `chat:reaction:update`
  - send-time custom emoji authorization reused for custom reaction values
- Reactions frontend implemented:
  - quick-react buttons send reaction toggles
  - picker reaction toggles
  - reaction chips render and update in realtime
- Reply backend implemented:
  - `replyMessageId` on messages schema + migration
  - reply id included in DTOs/realtime payloads
  - reply validation on send (target exists + same channel)
- Reply frontend implemented:
  - `replyingTo` state lifted to `ChannelChatView`
  - composer reply banner with cancel and Escape-to-cancel
  - send includes `replyMessageId`
  - reply preview shown above reply message header
  - preview click jumps to target message
  - target message highlight with fade animation
- Grouped message rendering implemented with locked rules:
  - same author + <=3 min + same day + current not reply => grouped
  - reply message always starts a group (header shown)
  - date boundary breaks groups
  - tighter top padding on grouped rows


## Locked Behavior Decisions

### Grouping Rules

- Group consecutive messages by same `authorUserId`.
- Break groups when time gap between consecutive messages is `> 3 minutes`.
- Reply messages (`replyMessageId !== null`) always show header and start a new group.
- Reply messages can be the first message in a group; following non-reply messages may group under them.
- Date separator boundaries break grouping.
- Deleted/edited/reactions do not break groups.

### Anchored Picker Rules

- Message-row picker opens to the left of trigger icon using viewport coordinates.
- When near viewport bottom, picker is pushed upward instead of shrinking.
- Outside click and Escape close picker.


## Key Files Updated So Far

- `apps/web/src/features/chat/MessageRow.tsx`
- `apps/web/src/features/chat/message-actions/MessageActionMenu.tsx`
- `apps/web/src/features/chat/emoji/EmojiPicker.tsx`
- `apps/web/src/features/chat/ChannelChatView.tsx`
- `apps/web/src/features/chat/ChatComposer.tsx`
- `apps/web/src/features/chat/hooks/useChatMessaging.ts`
- `apps/api/src/chat/chat.gateway.ts`
- `apps/api/src/chat/chat.service.ts`
- `packages/shared/src/chat.ts`
- `apps/api/prisma/schema.prisma`


## Remaining Work

### Reactions

- Add explicit UI error surfacing for failed reaction toggles (currently TODO comments).
- Add optional in-flight state to reaction buttons/chips to reduce rapid toggle race UX.
- Add "show more reactors" API + UI flow (currently only first 3 display names).
- Add targeted service/controller tests for reaction persistence logic (gateway coverage exists).

### Replies

- Optional: fetch reply preview targets that are not in current message window (currently fallback text).
- Optional: enhance reply preview with richer formatting/metadata once profile pics are added.

### Adjacent Chat UX

- Add grouped-message avatar logic when profile images are introduced.
- Fine-tune grouped spacing and hover hit areas after avatar rollout.


## Nice-to-Have Follow-ups

- Anchored picker horizontal collision handling (left edge) if needed on narrow screens.
- Message action menu customization (quick emoji set per user).
- Theme-aware micro-polish for menu/chip contrast.


## Out of Scope (For This Document)

- Notifications and ping routing for replies/reactions.
- Full emoji tab system (favorites/common/community/friends).
- Redis cache rollout details (tracked separately in system/emoji docs).
