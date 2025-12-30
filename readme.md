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



### Game integration

#### WIP - these are my current notes as I think through the system design:

- One long-running game server per game type, each lobby gets it's own room with it's own game instance
- One Socket.IO namespace per game (e.g. /bouncer); within it, one room per matchId.
- API owns user identity, party/friends, matchmaking decisions, persistence (history/MMR/cosmetics).
- (Maybe) create a simple API wrapper project that can be shared by all game servers, which provides helpers for interacting with API backend(will only implement this if it feels needed as I'm working)
- Game server owns authoritative realtime sim + lobby/match runtime + final outcome.
- API matchmaking “handoff” object always includes: endpoint, namespace, matchId, ticket.
- matchId is a UUID (globally unique).
- Ticket is short-lived, signed, and includes at least: userId, gameId/namespace, matchId, and any other data that exists outside the game itself(e.g. titles or cosmetics the player has earned on the site which are wearable in games).
- On socket connect: verify ticket -> set socket.data.matchId -> socket.join(matchId) -> route all inputs to that lobby instance.
- Game server reports match result to API via a standardized results endpoint (server-authenticated).
