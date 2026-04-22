# TODOS

### Profile/avatar setup, current todos:
- Add and document environment-specific storage config strategy:
    - dev/staging/prod values for `S3_BUCKET_NAME` and `S3_ENV_PREFIX`
    - where each env var is sourced locally vs deployed environments
    - how to avoid leaking prod values into local/dev
- Add a clear local/dev vs prod `.env` workflow (and commit-safe examples):
    - `.env.example` defaults/placeholders
    - per-environment override files or deployment-level env configuration
    - startup checks for missing required storage env vars
- Configure web/frontend S3 URL per environment:
    - set `VITE_S3_BASE_URL` for local/dev (`apps/web/.env.local`)
    - set `VITE_S3_BASE_URL` in production build environment
    - document expected value format and fallback behavior when missing
- Configure CI/CD to inject frontend env vars at build time:
    - ensure `VITE_S3_BASE_URL` is provided in CI build job
    - keep secrets/config out of committed frontend env files
    - verify prod build artifact contains correct S3 base URL
- Add/verify IAM policy isolation by prefix per environment:
    - dev runtime identity can access only `dev/*`
    - staging runtime identity can access only `staging/*`
    - prod runtime identity can access only `prod/*`
- Revisit bucket strategy after initial rollout:
    - keep single shared bucket + prefixes for now
    - evaluate migration criteria to separate buckets per environment later
- Avatar profile persistence/rendering follow-through is complete.

### Quick and small improvements:
- Make username not case sensitive on login
- make topbar bg black, add a subtle warm glow coming out the bottom, as if it's soft overhead light for the page
- Image/video/link embedding: at first, just for embedding external links(e.g. YT or an image link). Uploading comes later
- Add a theme picker and make 'custom-dark' the default theme
- Don't re-render displayName/message time/PFP for messages sent by same user in quick succession.


### Main line features to work on next:
- Profile customization follow-up: name color + chat integration (avatar/name color in message rows)


### Design changes and new features:
- Channel sidebar in chat:
    - Make it collapsible
    - Each channel gets an icon/emoji that shows next to it's name. In collapsed mode, only emoji shows
    - Highlight channels based on status: dark red when notification, slightly illuminated when new messages, normal when nothing new



### OPTIMIZATIONS
- Use caching for some db requests, e.g. the user->emoji access check. 
    - can simply cache in-memory, but should probably wait until next step(implementing redis) and using that
- Redis to cache a lot of repeated DB requests, such as emoji checks, probably chat history, and likely channel auth checks
- Possibly remove some db reads/writes around messaging, e.g. validations that won't cause any real problems if they are violated(reply channel validation for example)
