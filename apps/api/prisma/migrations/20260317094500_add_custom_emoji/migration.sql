-- CreateEnum
CREATE TYPE "CustomEmojiScopeType" AS ENUM ('GLOBAL', 'COMMUNITY', 'USER');

-- CreateTable
CREATE TABLE "custom_emoji" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "CustomEmojiScopeType" NOT NULL,
    "scopeId" TEXT,
    "assetUrl" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_emoji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_emoji_scopeType_scopeId_idx" ON "custom_emoji"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "custom_emoji_createdByUserId_idx" ON "custom_emoji"("createdByUserId");

-- CreateIndex
CREATE INDEX "custom_emoji_deletedAt_idx" ON "custom_emoji"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "custom_emoji_active_scope_name_unique" ON "custom_emoji"("scopeType", COALESCE("scopeId", '__GLOBAL__'), "name") WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "custom_emoji" ADD CONSTRAINT "custom_emoji_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
