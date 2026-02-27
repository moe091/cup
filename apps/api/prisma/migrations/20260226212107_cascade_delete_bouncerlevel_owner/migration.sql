-- DropForeignKey
ALTER TABLE "bouncerlevel" DROP CONSTRAINT "BouncerLevel_ownerUserId_fkey";

-- AlterTable
ALTER TABLE "account" RENAME CONSTRAINT "user_pkey" TO "account_pkey";

-- AlterTable
ALTER TABLE "bouncerlevel" RENAME CONSTRAINT "BouncerLevel_pkey" TO "bouncerlevel_pkey";

-- AlterTable
ALTER TABLE "oauth" RENAME CONSTRAINT "OAuthAccount_pkey" TO "oauth_pkey";

-- RenameForeignKey
ALTER TABLE "oauth" RENAME CONSTRAINT "OAuthAccount_userId_fkey" TO "oauth_userId_fkey";

-- AddForeignKey
ALTER TABLE "bouncerlevel" ADD CONSTRAINT "bouncerlevel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "user_email_key" RENAME TO "account_email_key";

-- RenameIndex
ALTER INDEX "user_username_key" RENAME TO "account_username_key";

-- RenameIndex
ALTER INDEX "BouncerLevel_ownerUserId_idx" RENAME TO "bouncerlevel_ownerUserId_idx";

-- RenameIndex
ALTER INDEX "BouncerLevel_ownerUserId_name_key" RENAME TO "bouncerlevel_ownerUserId_name_key";

-- RenameIndex
ALTER INDEX "BouncerLevel_visibility_idx" RENAME TO "bouncerlevel_visibility_idx";

-- RenameIndex
ALTER INDEX "OAuthAccount_provider_providerAccountId_key" RENAME TO "oauth_provider_providerAccountId_key";

-- RenameIndex
ALTER INDEX "OAuthAccount_userId_idx" RENAME TO "oauth_userId_idx";
