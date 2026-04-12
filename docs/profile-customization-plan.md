---
description: Implementation plan for profile customization (avatar + user-selected display name color) with chat integration.
---

## Goal

Implement profile customization in a production-minded way with strict TypeScript contracts and clean extensibility:

- Users can set a custom profile picture.
- Users can select a display-name color from predefined options.
- Chat surfaces use per-user avatar and name color in both history and realtime payloads.
- The name-color system can later support unlockable colors via points/currency without breaking API contracts.

## Locked Decisions

- `nameColor` uses predefined values only (not arbitrary user hex input).
- The color choice is a token/identifier, not a literal color value.
- Users select from a small starter set in v1.
- Additional tokens can be unlocked later.
- Chat rendering falls back safely when color/avatar is unset.

## Name Color Model (Design)

### Why token-based values

- Keeps backend validation simple and strict.
- Prevents invalid or unreadable user-provided colors.
- Supports theme-aware color mapping on frontend.
- Allows adding unlock mechanics without changing existing payload shapes.

### Recommended data shape

- Persist `nameColorToken: string | null` on `User`.
- Null means use existing default chat accent behavior.
- Tokens are stable identifiers (for example `ember`, `moss`, `sky`) rather than CSS/hex values.

### Catalog and unlock-readiness

Model the color options as data (shared contract), with each option containing:

- `token`: canonical id.
- `label`: user-facing name.
- `hexLight` and `hexDark` or one theme-adaptive CSS variable key.
- `sortOrder`: deterministic picker order.
- `unlockRequirement`: nullable metadata for future economy integration.

This allows v1 to expose all starter colors while reserving structure for later locked/unlocked states.

## Scope (v1 for this branch)

### Included

- Add profile fields for avatar and name color token.
- Add API support to read/update those fields.
- Add profile UI controls for avatar and name color selection.
- Update shared chat DTOs so messages include author avatar + name color token.
- Render avatar + token-based name color in chat message rows.
- Preserve grouped message behavior.

### Deferred

- Points/currency balance and earning mechanics.
- Unlock ownership persistence and entitlement checks.
- Paid/premium color gating logic.
- Moderation tooling for avatar uploads.

## Backend Plan

### Prisma

Add user fields:

- `avatarUrl String?`
- `nameColorToken String?`

Optional follow-up if needed for stronger constraints:

- introduce enum for tokens once token set is stable enough.
- or keep string token with service-level allow-list validation for easier iteration.

### Validation rules

- `avatarUrl`:
  - must be null or valid absolute HTTPS URL.
  - must point to expected storage host pattern (configurable allow-list).
- `nameColorToken`:
  - must be null or one of supported predefined tokens.
  - reject unknown tokens with clear 400 message.

### API surfaces

- Extend `GET /api/users/me` response with new profile fields.
- Extend `PATCH /api/users/me` to accept avatar + name color updates.
- Add avatar upload flow endpoints (presign + finalize or equivalent) for object-storage upload path.

### Chat payload changes

Extend shared + backend mapping for both history and realtime:

- `authorAvatarUrl: string | null`
- `authorNameColorToken: string | null`

Required in:

- `ChatMessageDto` (history)
- `ChatRealtimeMessage` (socket)

## Frontend Plan

### Profile page

- Add avatar upload UI (file picker + preview + upload progress/error state).
- Add name-color picker using predefined token list.
- Save via profile update flow.
- Keep existing inline validation and error/success patterns.

### Chat rendering

- `MessageRow`:
  - show avatar in message header row.
  - color author display name using token mapping.
  - apply fallback to existing accent when token missing/unknown.
- grouped rows:
  - maintain compact layout when header is hidden.
  - ensure alignment and spacing still look intentional with avatar present.

### Shared token-to-style mapping

- Store a single source of truth for token -> CSS color mapping in frontend.
- Keep mapping theme-aware and readable against current backgrounds.
- Avoid hardcoding token styles inside chat row component.

## Upload/Storage Direction

Use object storage (S3-compatible) for avatars with CDN-friendly URLs.

Minimum v1 safeguards:

- file type allow-list (image mime types).
- max file size limit.
- generated object keys (do not trust original filename).
- enforce HTTPS public URL format in persisted profile data.

## Migration + Compatibility

- Existing users should get `avatarUrl = null`, `nameColorToken = null`.
- Existing messages continue to render via fallback defaults.
- Frontend should tolerate missing fields during rollout by using null-safe guards.

## Implementation Phases

1. Add shared type updates and Prisma fields/migration.
2. Add backend users/chat payload wiring and validation.
3. Add avatar upload endpoints and storage integration.
4. Add profile UI for avatar + name color selection.
5. Add chat UI updates (avatar + token color rendering).
6. Run lint/typecheck/test and do manual chat/profile verification.

## Test Scenarios (Targeted)

- Profile fetch returns avatar + name color fields.
- Profile update rejects unknown color token.
- Profile update rejects invalid avatar URL.
- Avatar upload path rejects unsupported file type and oversized file.
- Chat history messages include avatar + name color fields.
- Realtime chat messages include avatar + name color fields.
- Grouped rows render correctly with mixed avatar/header visibility.
- Missing token/URL falls back without UI breakage.

## Open Questions

- Final starter token list and display labels.
- Whether token catalog should live in shared package immediately or start in web/api with mirrored constants.
- Whether to add a dedicated color-catalog endpoint now or embed starter catalog in frontend for v1.
- Exact upload endpoint shape (single-step server proxy upload vs presigned direct upload with finalize).
