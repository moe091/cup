-- AlterTable
ALTER TABLE "user" ADD COLUMN "username" TEXT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "displayName" DROP NOT NULL;

-- Backfill usernames for existing users
WITH users_without_username AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "user"
  WHERE "username" IS NULL
)
UPDATE "user"
SET "username" = CASE
  WHEN users_without_username.row_number = 1 THEN 'NewUser'
  ELSE 'NewUser' || users_without_username.row_number::TEXT
END
FROM users_without_username
WHERE "user"."id" = users_without_username."id";

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
