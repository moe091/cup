---
description: Incremental implementation plan for upcoming chat UX features (message hover menu, reactions/reply entry points, anchored emoji picker behavior).
---

## Goal

Add Discord-style message-row interaction affordances in safe incremental steps:

- Hover/focus highlight on message rows.
- Hover/focus message action menu (quick react, open picker, reply).
- Foundation for anchored emoji picker opening near the click target.


## Scope for This Slice

- Implement UI behavior only for row highlight and action menu visibility.
- Do not implement reaction/reply business logic yet.
- Add picker anchoring API/foundation without fully wiring message-menu picker behavior yet.


## Implementation Plan

### 1) Add Row Hover Highlight (CSS-first, no state)

- Keep hover behavior local to each row using CSS classes (`group`, `hover`, `focus-within`), not React hover state.
- Avoid list-wide rerenders and keep behavior scalable for long message lists.
- Scope: `MessageRow` visual highlight only.

### 2) Add `MessageActionMenu` component (UI-only)

- Add a new component under chat feature (recommended folder: `apps/web/src/features/chat/message-actions/`).
- Render in one horizontal pill:
  - 3 quick emoji buttons (default set for now)
  - open-emoji-picker icon button
  - reply icon button
- No feature behavior yet:
  - buttons can receive no-op handlers or optional callback stubs.
- Position menu as floating top-right over the message row (Discord-style).

### 3) Show Menu only on Row Hover/Focus

- Render menu inside `MessageRow` with absolute positioning.
- Visibility via CSS only:
  - visible on `:hover`
  - visible on `:focus-within` (keyboard accessibility)
- Keep menu hidden otherwise.
- Apply subtle row highlight when menu/hover is active.

### 4) Add Anchored Picker API Foundation

- Add optional anchored picker props so picker can open near trigger location:
  - `anchorX?: number`
  - `anchorY?: number`
  - optional placement mode (initial recommendation: left-start for message-row menu)
- Backward compatibility:
  - if no `anchorX/anchorY`, picker uses current default anchored behavior.

### 5) Wire Placeholder Action Props

- Define strict optional callbacks for future behavior:
  - `onQuickReact?(emoji: string): void`
  - `onOpenEmojiPicker?(): void`
  - `onReply?(): void`
- For this slice, pass no-ops or omit callbacks.


## Anchored Picker Positioning Rules (Current Decision)

For message-row action menu opening behavior:

- Open picker to the **left** of the clicked emoji-picker icon.
- Align picker **top** with icon top (`left-start` style alignment).
- Primary overflow requirement for now: prevent going off the **bottom** of viewport.

Implementation approach:

- Use `position: fixed` for anchored mode with viewport coordinates (`anchorX`, `anchorY`).
- Compute base position:
  - `left = anchorX - pickerWidth - gap`
  - `top = anchorY`
- Cap height with viewport-safe max height so it never renders off bottom:
  - `maxHeight = viewportHeight - top - viewportPadding`
  - picker becomes internally scrollable when content exceeds max height.
- This keeps behavior predictable even when sections collapse/expand.

Notes:

- This slice intentionally avoids full collision engine/floating library complexity.
- If future needs require all-direction collision handling, migrate to measured placement (or Floating UI) later.


## Why This Approach

- Minimal risk and clean incremental delivery.
- Performance-safe: CSS hover/focus avoids extra React state churn.
- Future-ready: action menu + anchored picker API supports reactions/reply flows and richer category UX later.


## Files Likely Touched

- `apps/web/src/features/chat/MessageRow.tsx`
- `apps/web/src/features/chat/message-actions/MessageActionMenu.tsx` (new)
- `apps/web/src/features/chat/emoji/EmojiPicker.tsx` (anchored prop foundation)
- Optional small helper/type files for action callbacks/anchor types.


## Out of Scope for This Slice

- Persisting reactions in backend/db.
- Reply threading/reply payload changes.
- Notification updates.
- Full picker tab system (favorites/common/community/friends/etc.).
