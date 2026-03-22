-- AlterTable
ALTER TABLE "message"
ADD COLUMN "replyMessageId" TEXT;

-- CreateIndex
CREATE INDEX "message_replyMessageId_idx" ON "message"("replyMessageId");

-- AddForeignKey
ALTER TABLE "message"
ADD CONSTRAINT "message_replyMessageId_fkey"
FOREIGN KEY ("replyMessageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
