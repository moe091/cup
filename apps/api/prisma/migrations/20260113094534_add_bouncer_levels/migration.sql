-- CreateEnum
CREATE TYPE "BouncerLevelVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'SYSTEM');

-- CreateTable
CREATE TABLE "BouncerLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "ownerUserId" TEXT,
    "visibility" "BouncerLevelVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BouncerLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BouncerLevel_ownerUserId_idx" ON "BouncerLevel"("ownerUserId");

-- CreateIndex
CREATE INDEX "BouncerLevel_visibility_idx" ON "BouncerLevel"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "BouncerLevel_ownerUserId_name_key" ON "BouncerLevel"("ownerUserId", "name");

-- AddForeignKey
ALTER TABLE "BouncerLevel" ADD CONSTRAINT "BouncerLevel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
