-- CreateEnum
CREATE TYPE "CommunityJoinMode" AS ENUM ('PUBLIC', 'REQUEST', 'INVITE_ONLY');

-- AlterTable
ALTER TABLE "channel" ADD COLUMN     "requiredPermissionLevel" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "community" ADD COLUMN     "joinMode" "CommunityJoinMode" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "community_member" ADD COLUMN     "permissionLevel" INTEGER NOT NULL DEFAULT 1;
