# --- Stage 1: Node and pnpm setup --- #
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# --- Stage 2: Copy all files that might effect deps then install deps --- #
FROM base AS deps
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY games/bouncer/shared/package.json ./games/bouncer/shared/
COPY games/bouncer/engine/package.json ./games/bouncer/engine/
COPY games/bouncer/server/package.json ./games/bouncer/server/

RUN pnpm install --frozen-lockfile


# --- Stage 3: Build --- #
FROM deps AS builder
WORKDIR /repo

COPY tsconfig.base.json ./

COPY games/bouncer/shared/ ./games/bouncer/shared/
COPY games/bouncer/engine/ ./games/bouncer/engine/
COPY games/bouncer/server ./games/bouncer/server/

RUN pnpm --filter @cup/bouncer-shared build
RUN pnpm --filter @cup/bouncer-engine build

RUN pnpm --filter @cup/bouncer-server build

RUN pnpm deploy --filter @cup/bouncer-server --prod --legacy /deploy


# --- Stage 4: Production --- #
FROM node:22-alpine AS production

#create user to run app
RUN addgroup -S bouncer && adduser -S bouncer -G bouncer

WORKDIR /games/bouncer

#copy deps
COPY --from=builder --chown=bouncer:bouncer /deploy/node_modules ./node_modules
COPY --from=builder --chown=bouncer:bouncer /deploy/package.json ./package.json

#copy bouncer build
COPY --from=builder --chown=bouncer:bouncer /repo/games/bouncer/server/dist ./dist

USER bouncer

EXPOSE 4001

CMD ["node", "dist/main.js"]