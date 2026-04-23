---
description: Current implementation status and forward plan for profile customization (avatar + name color) with chat integration.
---

## Goal

Implement profile customization in a production-minded way with strict TypeScript contracts and clean extensibility:

- Users can set a custom profile picture.
- Users can select a display-name color from predefined options.
- Chat surfaces use per-user avatar and name color in both history and realtime payloads.
- The name-color system can later support unlockable colors via points/currency without breaking API contracts.

---

## Current Status (Merged to `master`)

### Avatar feature: **Implemented end-to-end**

Implemented and verified:

- User can select avatar image on `/profile` and preview before save.
- Frontend requests presigned upload target from backend.
- Frontend uploads file directly to S3 via presigned `PUT` URL.
- Backend persists `avatarKey` to user profile via field-specific endpoint.
- Profile page renders persisted avatar from key-derived S3 URL.
- Replacing avatar deletes old S3 object (best-effort cleanup).
- If persisted avatar object is missing in S3, frontend naturally shows broken image (no silent forced default mutation).

### Name color feature: **Not implemented yet**

Still planned, with locked direction:

- predefined token values
- user-selectable in profile
- unlock-ready architecture for future points/currency system

---

## Locked Decisions

- `nameColor` uses predefined values only (not arbitrary user hex input).
- The color choice is a token/identifier, not a literal color value.
- Users select from a small starter set in v1.
- Additional tokens can be unlocked later.
- Chat rendering falls back safely when color/avatar is unset.

### Avatar storage decisions

- Persist `avatarKey` (not public URL) on `User`.
- Use S3 object storage with key format:
  - `<envPrefix>/avatars/<userId>/<uuid>.<ext>`
- Upload flow is direct-to-S3 with backend-issued presigned targets.
- Frontend renders avatar by resolving `avatarKey` against `VITE_S3_BASE_URL`.

---

## Implemented Architecture

### Backend

#### Data model

- `User.avatarKey: String?` added and in use.

#### Users API surface (current)

- `GET /api/users/me`
- `PATCH /api/users/me/username`
- `PATCH /api/users/me/display-name`
- `PATCH /api/users/me/email`
- `PATCH /api/users/me/avatar` (stores/clears `avatarKey`)
- `POST /api/users/me/avatar/upload-target`

#### Avatar upload target flow

- Request payload: `{ mimeType, sizeBytes }`
- Validates payload shape + max size.
- Storage service validates supported mime and signs S3 PUT URL.
- Returns `{ uploadUrl, method, headers, objectKey, expiresInSeconds }`.

#### Avatar replace cleanup

- `PATCH /api/users/me/avatar` reads previous `avatarKey`.
- Updates DB to new key.
- If previous key existed and changed, calls `storageService.deleteObject(oldKey)`.
- Delete failure is logged as warning and does not fail avatar update response.

#### Config

- Uses Nest `@nestjs/config` with storage-specific config provider.
- Storage config fields:
  - `S3_BUCKET_NAME`
  - `AWS_REGION`
  - `S3_ENV_PREFIX` (default `dev`)

### Frontend

#### Profile UI behavior

- Field-specific save/cancel/edit flow per profile field.
- Avatar field supports local preview + upload + save.
- Avatar save sequence:
  1. request upload target
  2. upload to S3
  3. patch `avatarKey`
  4. refresh profile/auth state

#### S3 URL config

- `buildS3AssetUrl` helper in `apps/web/src/config/s3.ts`
- Reads `VITE_S3_BASE_URL`.
- Warns once in dev if unset.

---

## Security / Validation Notes (Current)

- Upload target endpoint requires authenticated session + CSRF.
- Avatar key update validates user-owned key prefix (`<env>/avatars/<userId>/...`).
- Supported avatar mime allow-list in storage service (`png`, `jpeg`, `webp`).
- Max avatar size enforced in users service.

Note:

- Current rendering strategy assumes S3 URLs are browser-readable for avatar keys in use.
- Public-read policy configuration is an infrastructure concern and may evolve to CDN/signed-read later.

---

## Testing Status

- Added/updated unit tests for users controller/service and storage service relevant to avatar flow.
- API test suite currently passes.
- Covered behavior includes:
  - avatar upload target delegation/validation
  - avatar key update behavior
  - old avatar delete best-effort behavior
  - storage service upload target + delete command behavior

---

## Deferred / Next Work

### Name color (next profile customization milestone)

- Add `nameColorToken` profile field + validation.
- Add predefined token catalog and profile picker UI.
- Add chat rendering support for per-user name color.

### Chat avatar integration

- Add avatar fields into chat DTOs/realtime payloads for message rows.
- Render avatar in chat message rows (including grouped message layout rules).

### Infrastructure follow-ups

- Finalize env strategy for dev/staging/prod + CI injection.
- Prefix-scoped IAM policy hardening per environment.
- Production logging policy (sink, retention, levels).

---

## Quick Context for New Chats

If starting a new chat and you want to continue from current state, this is the key summary:

- Avatar upload/persist/display is fully implemented and merged.
- Backend uses field-specific user update endpoints (generic `PATCH /users/me` removed).
- `avatarKey` is source of truth in DB.
- Frontend resolves `avatarKey` via `VITE_S3_BASE_URL`.
- Old avatar S3 objects are deleted on replacement (best-effort).
- Next major profile task is name color tokens and chat integration.
