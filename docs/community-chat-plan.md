---
description: Current community/chat TODOs (post-discover/join/leave/delete baseline).
---

## Current Status (Done)

- Community create flow (name, description, join mode, optional icon) is implemented.
- Community discover page + search + pagination is implemented.
- Join/leave/delete community endpoints and UI flows are implemented.
- Community invite links now point to `/communities/:slug?invite=true`.
- Community page invite CTA + join/open-chat behavior is implemented for public communities.

## Next TODOs

### 1) Community settings

- Build community settings page.
- Support editing:
  - description
  - icon
  - public/private join mode
- Later:
  - member management UI (or separate page)
  - permission-level management UI
  - permission-level naming (levels 1-10)
  - configurable per-level capabilities (ban, channel actions, message moderation, etc.)

Notes:
- Keep owner-level controls protected server-side regardless of UI visibility.
- Permission capabilities likely need a dedicated schema/table instead of hardcoded checks.

### 2) Channel management (create/edit/delete)

- Add channel create/edit/delete flows.
- Primary UX path: channel-list right-click context menu.
- Add permission checks for channel actions.
- Later: channel sections/categories for organization.

Notes:
- Decide whether to build a reusable context-menu component vs per-surface menus.
- If reusable, support configurable visibility/enable rules for each menu action.

### 3) Private community invites/joining

- Add "Invite friends" action on community context menu.
- Invite modal should show friend list with:
  - "Send invite"
  - "Cancel invite" when pending
- Sending invite should:
  - DM invite link to target user
  - create invite record for private-community access checks
- Community page should validate private invites server-side before allowing join.

Notes:
- Invite table draft fields:
  - inviteeUserId
  - inviterUserId
  - communityId
  - createdAt
  - expiresAt (optional, default maybe 30 days)
- Prefer stable IDs (`communityId`) over slug in invite records.

### 4) Friends + DMs (dependency for #3)

- Implement friend system + friend list APIs/UI.
- Implement DM flows needed for invite delivery.
- Treat this as a separate larger branch/project.

Notes:
- #3 is partially blocked by #4.

## Suggested Immediate Order

1. Community settings (basic editable fields first)
2. Channel create/edit/delete with permission checks
3. Friends + DMs foundation
4. Private invite flow
