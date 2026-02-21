-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "lobby" (
    "matchId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'OPEN',
    "socketUrl" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 4,
    "createdByUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "lobby_pkey" PRIMARY KEY ("matchId")
);

-- CreateIndex
CREATE INDEX "lobby_gameId_status_idx" ON "lobby"("gameId", "status");

-- CreateIndex
CREATE INDEX "lobby_expiresAt_idx" ON "lobby"("expiresAt");

-- AddForeignKey
ALTER TABLE "lobby" ADD CONSTRAINT "lobby_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
