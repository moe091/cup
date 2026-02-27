-- Rename existing tables to match Prisma @@map names without data loss
ALTER TABLE "user" RENAME TO "account";
ALTER TABLE "OAuthAccount" RENAME TO "oauth";
ALTER TABLE "BouncerLevel" RENAME TO "bouncerlevel";
