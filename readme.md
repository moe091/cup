This readme will serve as my own personal notes/documentation for now.


## Description
This is the description I typed up for claude and chatgpt when testing them by asking for help 
building a level editor. I figured it'd be useful to keep here for reference and to possibly use 
again to build context when using an LLM:


a web app that includes a bunch of multiplayer minigames for users to play with their friends. The first game is a 2d physics-based platformer where you click and drag the mouse to fling a ball through level and race your friends to the goal. It uses box2d for physics and so far just has simple shapes - rectangles and circles. 

The web app is a large monorepo consisting of a few projects: the backend api used for user data, friends lists, messaging, game histories and storing game levels, etc. The frontend, a react web app. A shared project, mostly consisting of shraed typescript types. And 'bouncer' the game I described above which is made with typescript, phaser, and box2d and is embedded in the frontend. 

Bouncer is further broken down into several projects: The 'engine', is a standalone world simulation using box2d. It contains the box2d(using planckjs) world and exposes a 'step' function that ticks the physics simulation forward. It also accepts user input data which is represented as the click+drag vector(delta x and delta y) as well as the corresponding playerId to map the input to the correct ball. It can also load levels in the form of a LevelDefinition type object defined in my typescript. Then there is the server, right now there is only 1 instance of the server ever running, and for each match/lobby it creates a different socket.io 'room'. The server 'owns' an engine instance for each lobby/room and it communicates with the clients via socket.io to receive input and send back gamestate updates, as well as managing over flow(players joining/leaving, match transitions, level selection and loading, etc). Then there is the client project which is what runs in the web app, it's a phaser game that basically just renders what the server tells it to and listens for user input and sends it up to the server. Later on I want to add an engine instance to the client as well and have the client do client-side prediction, but I"m not worried about that yet. The client project also includes a level editor as a kind sub-sub-project. It allows users to create/delete rectangular platforms, place spawn points, and save levels(levels are sent to the backend api, which saves them in a postgresql database). Finally, bouncer also has it's own 'shared' project for shared types specific to the game.


## System Design
- Monorepo project with sub-projects:
    - API: Nestjs backend API
    - WEB: React frontend
    - GAME(todo): The actual game project(s). (Just bouncer for now)
        - Engine: Runs the actual simulation using box2d. Accepts play inputs as input and outputs world state. Manually ticked via a step function that runs a physics step
        - Server: Single server that creates rooms(Match instance) for each lobby(lobby info sent to API and stored in DB). Each Match has it's own Engine instance. Handles syncing clients with game world
        - Client: Dumb client, visually renders what the server tells it to. Sends inputs and other updates to server, gets world state and match updates from server
        - Shared: Mostly shared types between client and server. Some util functions like level-loading
    - Shared-Types: a shared project to act as a single source of typescript types between backend/frontend

- CI/CD
    - Will use github actions for CI.
    - Test, typecheck, format only on merge back into master(for now)
    - CD not planned yet, will deploy and automate deployment after bouncer is done

Details:
Nestjs API will talk to postgresql db running in docker. It will handle user info(accounts, friends lists, messages), Game data(levels, lobby info, match histories) for each game
Static react frontend that 


### API
Using Nestjs. For now it will handle user accounts, friends lists, scores / match history, etc. Basically just user info. Will add more as needed after the base project is completed

Passport for OAuth, using express-session so it's super easy to create/delete sessions and scaling/performance won't be an issue for my project

PostgreSQL with Prisma for database, because I like postgres, and Prisma seems very easy to use and allegedly integrates best with typescript.



### Frontend 

Simple react, SPA style. No SSR or anything fancy needed. UI will be ver minimal and clean. Frontend will have a /game route that has a gameName arg and actual games will be their own projects which are exported as packages then frontend can just import the correct game package depending on the gamename arg

