
# --- Stage 1: Node and pnpm setup --- #
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# --- Stage 2: Copy only files that effect dependencies and then install dependencies --- #
FROM base AS deps
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY packages/shared/package.json ./packages/shared/
COPY games/bouncer/shared/package.json ./games/bouncer/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# --- Stage 3: build --- #
FROM deps AS builder
WORKDIR /repo

#copy base tsconfig
COPY tsconfig.base.json ./

#copy projects
COPY packages/shared/ ./packages/shared/
COPY games/bouncer/shared/ ./games/bouncer/shared/
COPY apps/api/ ./apps/api/

#build workspace dependencies
RUN pnpm --filter @cup/shared-types build
RUN pnpm --filter @cup/bouncer-shared build

#generate prisma client
RUN pnpm --filter @cup/api exec prisma generate

#build api
RUN pnpm --filter @cup/api build

#pnpm deploy to create /deploy dir with prod dependencies resolved
RUN pnpm deploy --filter @cup/api --prod --legacy /deploy


# --- Stage 4: prod --- #
FROM node:22-alpine AS production

#create user to run app
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

#copy deps from last stage and setup perms for app user
COPY --from=builder --chown=app:app /deploy/node_modules ./node_modules
COPY --from=builder --chown=app:app /deploy/package.json ./package.json

# copy built api, prisma schema, and prisma client from last stage
COPY --from=builder --chown=app:app /repo/apps/api/dist ./dist
COPY --from=builder --chown=app:app /repo/apps/api/prisma ./prisma
COPY --from=builder --chown=app:app /repo/apps/api/prisma.config.ts ./prisma.config.ts

USER app

#note that api listens on port 3000
EXPOSE 3000

CMD ["node", "dist/src/main"]