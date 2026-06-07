-- Add permissionConfig as nullable first
ALTER TABLE "community" ADD COLUMN "permissionConfig" JSONB;

-- Backfill existing communities
UPDATE "community"
SET "permissionConfig" = '{
  "createChannel": 5,
  "editChannelName": 6,
  "deleteChannel": 6,
  "editGeneral": 9
}'::jsonb
WHERE "permissionConfig" IS NULL;

-- Enforce required column after backfill
ALTER TABLE "community" ALTER COLUMN "permissionConfig" SET NOT NULL;
