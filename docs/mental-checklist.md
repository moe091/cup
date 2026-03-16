---
description: Practical mental checklist for writing professional, robust TypeScript API/frontend code.
---

## Quick Mental Checklist (Use Before Finalizing Any Function)

1. **Types and shapes**
2. **Input parsing and validation**
3. **Auth + access control**
4. **Transport details (fetch/http)**
5. **Error strategy**
6. **Call-site ergonomics**
7. **State and async safety**
8. **Contract alignment across layers**

---

## 1) Types and Shapes

Ask:

- What is the runtime source of this value?
  - URL/query/body -> usually starts as `string`/`unknown`.
  - DB IDs -> usually `string` in this project.
  - counts/limits -> usually `number` after parsing.
- What is the narrowest safe type I can use **after** parsing?

Rules of thumb:

- **Raw input type** should reflect reality (`string | undefined` for query params).
- **Parsed/internal type** should reflect business intent (`number`, `Date`, required fields).
- Use `?` / `| undefined` when a field is truly optional at that layer.
- If data is required for correct logic, make it required in parsed/internal types.

Example pattern:

- `ChannelHistoryQueryRaw` -> `limit?: string`
- `ChannelHistoryQueryParsed` -> `limit: number`

---

## 2) Input Parsing and Validation

Mini-checklist:

- **Range/format checks**: number bounds, valid date parsing, allowed enums.
- **Pair dependencies**: if A requires B, enforce both-or-neither.
- **Defaulting**: define sensible default values (`limit = 25`).
- **Resource protection**: cap user-controlled values (`MAX_LIMIT`).

Mental model:

- Validate wherever data crosses a trust boundary:
  - request -> controller/service
  - service -> DB query
  - API response -> UI rendering assumptions

How to spot pair dependencies:

- Ask: "Can this field make sense on its own?"
  - If no, pair-validate.
  - Example: `beforeId` only makes sense with `beforeCreatedAt`.

---

## 3) Auth and Access Control

Ask:

- Is this route public, authenticated, or conditional (public + member-only private)?
- Where is access enforced so it cannot be bypassed accidentally?

Rule:

- Prefer enforcing access in service methods (not only controller), especially for reusable logic.

---

## 4) Transport Details (Fetch/HTTP)

For each fetch, check:

- `method`: GET/POST/PATCH/etc correct?
- `credentials: "include"` needed for session-cookie auth?
- `cache: "no-store"` needed for fresh user/chat/security data?
- `Content-Type: "application/json"` needed when sending JSON body?
- CSRF header needed for mutating requests (POST/PUT/PATCH/DELETE)?
- Query/path values encoded (`URLSearchParams`, `encodeURIComponent`)?

Common headers/options and when:

- `Content-Type: application/json`
  - Use when body is JSON.
- `x-csrf-token`
  - Use on mutating routes protected by CSRF middleware.
- `credentials: include`
  - Use when backend auth is cookie/session based.
- `cache: no-store`
  - Use for data that must not be stale (profile/auth/chat state).

---

## 5) Error Strategy

Ask:

- What failures are expected here (invalid input, unauthorized, not found, network, DB)?
- Is this failure actionable for caller/user?

Backend guidance:

- `BadRequestException` for malformed/invalid inputs.
- `UnauthorizedException` for missing auth where required.
- `ForbiddenException` for no permission with known identity/resource.
- `NotFoundException` for missing resources.

Frontend guidance:

- Always handle `!response.ok`.
- Throw meaningful errors with context (`endpoint + status`).
- Convert unknown errors to safe fallback messages for UI.

Mental trigger for errors:

- If your next line assumes something must be true, validate it and fail early.

---

## 6) Call-Site Ergonomics

Meaning: make common usage easy and hard usage explicit.

Examples:

- Good: `fetchChannelHistory(channelId)` with sensible defaults.
- Advanced still possible: `fetchChannelHistory(channelId, { limit, beforeCreatedAt, beforeId })`.

Checklist:

- Are defaults in place for common case?
- Is function signature readable?
- Are argument shapes clear (`params` object over long positional lists)?

---

## 7) State and Async Safety (Frontend)

Checklist:

- Avoid stale updates after unmount/param switch (`active` flag or abort).
- Keep one source of truth for selected state.
- Keep dependency arrays complete and intentional.
- Use `useMemo`/`useCallback` when identity stability helps props/effects.

---

## 8) Contract Alignment Across Layers

Checklist:

- Shared DTOs for API responses used by frontend.
- Backend-only raw input types stay backend-side.
- Convert date objects to ISO strings in API responses.
- Keep ordering/cursor semantics explicit and consistent.

---

## Practical Workflow (Fast, Senior-Like)

1. Define raw input shape.
2. Parse + validate into strict internal shape.
3. Enforce access rules.
4. Execute DB/business logic.
5. Map to response DTO.
6. Add one manual test URL and one edge-case test.

If you run this loop every time, quality becomes automatic.
