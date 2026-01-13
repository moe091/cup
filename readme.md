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
