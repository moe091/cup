This readme will serve as my own personal notes/documentation for now.

## System Design
- Monorepo project with sub-projects:
    - API: Nestjs backend API
    - WEB: React frontend
    - GAME(todo): The actual game project
    - Shared-Types: a shared project to act as a single source of typescript types between backend/frontend

- CI/CD
    - Will use github actions for CI.


### API
Using Nestjs. For now it will handle user accounts, friends lists, scores / match history, etc. Basically just user info. Will add more as needed after the base project is completed

Passport for OAuth, using express-session so it's super easy to create/delete sessions and scaling/performance won't be an issue for my project

PostgreSQL with Prisma for database, because I like postgres, and Prisma seems very easy to use and allegedly integrates best with typescript.



### Frontend 

Simple react, SPA style. No SSR or anything fancy needed. UI will be ver minimal and clean. Frontend will have a /game route that has a gameName arg and actual games will be their own projects which are exported as packages then frontend can just import the correct game package depending on the gamename arg


### Bouncer TODOs:

X Add an arrow UI thing when user is clicking/dragging to indicate force and direction
- add a goal and handle win state
- add match flow. E.g. rematches, change level, best of 3, etc.
- Implement ticket system for user verification in matches
- Implement real level saving
- Add moving platforms
- Add some basic animations/sounds for juiciness
- Implement name check on save level to make sure it's valid and safe
- Display "Match Not Found"(and other error msgs) when matchId doesn't exist of ticket is invalid
- Warn guests that they can't save level if they aren't logged in


Obstacle ideas:
- Bounce blocks / trampoline
- Wind currents(any direction)
- Ice Cube(freezes player for ~5 seconds. Destroys the hazard)
- Grav-flip
- Dynamic physics objects like a door/plank to knock down, a see-saw(Co-op levels later on???)
- Spinning platforms(slow ones can block passages, fast ones can launch players)
- Sticky platforms
- Boulders(circular, can be rolled around)



### Bouncer Match Flow and UX Notes:
Routes + Purpose

/games/bouncer (Landing)
Buttons:
Play Now (solo for now; later solo vs matchmaking choice)
Create Custom Lobby (for friends; generates matchId + share link)
Level Editor
Later: “Join Match” panel showing friends/public lobbies
/games/bouncer/:matchId (Friend lobby)
Used when someone shares a link.
Waiting room + ready up + leader controls settings
Can invite friends by sharing the URL
/games/bouncer/play (Solo / Matchmaking)
For now: creates a solo lobby (maxPlayers=1)
Later: shows Play Solo vs Matchmake
Matchmaking behavior:
Join existing open lobby or create a new one
While waiting for full lobby, place players in a free‑play map
When lobby fills, reset and start real match
Match Flow (Friend Lobby)

Waiting room: players list + ready status
Leader selects level/settings
Ready‑up with auto‑start when min players ready
Leader can override “Start now”
If leader leaves → auto‑assign new leader
Solo Flow

Start immediately
If someone joins, reset into a real match
Later add “play offline” to avoid interruptions (client‑side engine)
