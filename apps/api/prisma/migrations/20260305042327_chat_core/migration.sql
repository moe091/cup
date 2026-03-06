/*
  Warnings:

  - You are about to drop the column `hello` on the `message` table. All the data in the column will be lost.
  - Added the required column `authorUserId` to the `message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `body` to the `message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channelId` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('COMMUNITY', 'DM', 'GAME_PAGE', 'ROOM');

-- CreateEnum
CREATE TYPE "ChannelVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MembershipSource" AS ENUM ('MANUAL', 'DERIVED');

-- AlterTable
ALTER TABLE "message" DROP COLUMN "hello",
ADD COLUMN     "authorUserId" TEXT NOT NULL,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "channelId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_member" (
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryRole" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_member_pkey" PRIMARY KEY ("communityId","userId")
);

-- CreateTable
CREATE TABLE "channel" (
    "id" TEXT NOT NULL,
    "communityId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "visibility" "ChannelVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_member" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "MembershipSource" NOT NULL DEFAULT 'MANUAL',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_member_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_slug_key" ON "community"("slug");

-- CreateIndex
CREATE INDEX "community_ownerUserId_idx" ON "community"("ownerUserId");

-- CreateIndex
CREATE INDEX "community_member_userId_idx" ON "community_member"("userId");

-- CreateIndex
CREATE INDEX "channel_communityId_idx" ON "channel"("communityId");

-- CreateIndex
CREATE INDEX "channel_createdByUserId_idx" ON "channel"("createdByUserId");

-- CreateIndex
CREATE INDEX "channel_kind_idx" ON "channel"("kind");

-- CreateIndex
CREATE INDEX "channel_visibility_idx" ON "channel"("visibility");

-- CreateIndex
CREATE INDEX "channel_member_userId_idx" ON "channel_member"("userId");

-- CreateIndex
CREATE INDEX "channel_member_source_idx" ON "channel_member"("source");

-- CreateIndex
CREATE INDEX "message_channelId_createdAt_id_idx" ON "message"("channelId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "message_authorUserId_createdAt_idx" ON "message"("authorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "community" ADD CONSTRAINT "community_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member" ADD CONSTRAINT "channel_member_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member" ADD CONSTRAINT "channel_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
