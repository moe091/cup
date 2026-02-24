---
description: Multiplayer minigame platform with physics racing and social features.
---

## Product vision

A social web platform for friends to hang out and play quick, casual multiplayer minigames. Focus on clean and 'comfy' UI. Aim to feel more like a 'hangout spot' than a website by integrating friends and social features into everything - e.g. seamlessly add friends to games and chats, form groups/parties to do activities together, and even show friends/party-members avatars on pages so you can visually run into friends who are on the same page, making it feel like a real 'world'.

## Core user goals

- **Quick play**: Start a game instantly or join friends in seconds.
- **Social**: Lobbies, friend invites, public/private level sharing.
- **Environment**: Make it feel more like a 'place' than a website by seamlessly integrating social features and treating web pages like gathering places.

## UX principles

- **Minimal friction**: Few steps to start playing.
- **Clear feedback**: Visual + text cues for all actions.
- **Responsive on web and mobile**.
- **Juice**: Borrow the game dev concept of "juiciness" to make all user interactions satisfying and full of feedback

---

## Subproject breakdown

### API (apps/api)

- NestJS backend for users, lobbies, scores, level storage.
- PostgreSQL + Prisma.

### Frontend (apps/web)

- React SPA, minimal UI, game selector routing.
- Auth via Passport, sessions.

### Bouncer game (games/bouncer/)

#### Engine

- planck.js box2d physics.
- Deterministic: inputs → same outputs.
- Designed to easily support client-side prediction(currently engine only runs on server)

#### Server

- Room/match management via Socket.IO.
- Own Engine instance per lobby.
- 1 server instance for all bouncer games, server instance creates Socket.IO rooms for each lobby(and a 'Match' instance)

#### Client

- Phaser visual renderer.
- Handles user input, sends to server.
- Also includes level editor

#### Shared (types)

- Game-specific level/data types.

---

## Development workflow

- `pnpm run dev` for local hot‑reload.
- End of feature → `lint`, `typecheck`, `test` before commit.
- CI runs same checks on PR.

---

## Current TODO priorities

User account and profile features:
-add login methods(discord OAuth and username/password)
-add user profile page(set displayName and other settings)
-add user dropdown to topbar(logged in users can click on their name on the right side of topbar and it will dropdown a user menu with options for logout, profile, my homepage, etc)


---

