-- CreateEnum
CREATE TYPE "ReactionEmojiKind" AS ENUM ('UNICODE', 'CUSTOM');

-- CreateTable
CREATE TABLE "message_reaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactorDisplayName" TEXT NOT NULL,
    "emojiKind" "ReactionEmojiKind" NOT NULL,
    "emojiValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_reaction_messageId_userId_emojiKind_emojiValue_key" ON "message_reaction"("messageId", "userId", "emojiKind", "emojiValue");

-- CreateIndex
CREATE INDEX "message_reaction_messageId_emojiKind_emojiValue_createdAt_idx" ON "message_reaction"("messageId", "emojiKind", "emojiValue", "createdAt");

-- CreateIndex
CREATE INDEX "message_reaction_userId_idx" ON "message_reaction"("userId");

-- AddForeignKey
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
