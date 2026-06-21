# TODOS


### Before sharing with friends:
- Update chat page to show a prompt to join/browse communities if a user doesn't belong to any communities
- Add PFP to messageRow in chat
- Fix toast message pushing entire chat component down, causing it to go off the bottom of the screen
- refreshing while on chat page on live site causes 403 error

### High Level:
- Allow adding friends, joining communities. Add Friends and Communities pages to profile
- Render pfps in chat
- Setup CD and deploy to AWS!

### Bugfixes:
- Toast message after creating community pushes entire layout down, chat composer gets cut off bottom of screen
- Ready button not rendering in bouncer

### Community/channel permission notes:
- When channel create/edit endpoints are implemented, enforce rule: non-public communities (`REQUEST`, `INVITE_ONLY`) cannot have channels with `requiredPermissionLevel = 0`.

### Chat features
- Store currently typed messages in localStorage so that if user leaves the page, changes channels, etc, they won't lose any in-progress messages.
- add a frontend-character limit restriction with UI so that users know the message length and don't type out super long messages only to have them fail

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
- Configure production logging (sink, retention, and log-level policy).
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
- Create reusable toast message component and replace existing toast messages


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



### Bouncer - current plans
- Add checkpoints and hazards. Checkpoints are sensor objects(potentially invisible) that, when passed through, are set as the 'last crossed checkpoint'. Hazards are sensor objects
    that, when touched, freeze the balls position and play some kind of dieing/exploding animation(~1s or less) and then instantly teleports the player to the last checkpoing(will
    need to either add a way in the editor to place a checkpoint rectangle AND add a respawn point correlated with that checkpoint, or just always respawn at the mid-point of the 
    checkpoint rect). No need for server-side validation, I'm not worrying about anti-cheat for casual minigames like this(at least not yet).

- Improvements/Juice:
    - Make sawblades actually spin. 
    - Add some moving and pulsing hazards(lasers?)
    - pulsing plats
    - custom non-hazard objects(e.g. windmill)
    - double jump effect/animation
    - dash effect/animation
    - death effect/animation
    - sound fx: jump, doublejump, dash, death, checkpoint, finish, wall hit, background music