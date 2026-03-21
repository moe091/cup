import {
  ChannelHistoryResponseDto,
  ChatTokenResponse,
  MessageReactionAggregateDto,
  MessageReactionSummaryDto,
  ReactionEmojiKind,
} from '@cup/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ChannelHistoryQueryParsed, ChannelHistoryQueryRaw } from './chat.types';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';

const CHAT_TOKEN_TTL_SECONDS = 10 * 60;
const DEFAULT_MSG_LIMIT = 25;
const MAX_MSG_LIMIT = 200;
const CUSTOM_EMOJI_TOKEN_REGEX = /<:([a-zA-Z0-9_-]{1,64}):([a-zA-Z0-9_-]{1,128})>/g;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanUseCustomEmojis(channelId: string, senderUserId: string, body: string): Promise<void> {
    const customEmojiIds = this.extractCustomEmojiIds(body);
    if (customEmojiIds.length === 0) {
      return;
    }

    const customEmojis = await this.prisma.customEmoji.findMany({
      where: {
        id: { in: customEmojiIds },
        deletedAt: null,
      },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
      },
    });

    const customEmojiById = new Map(customEmojis.map((emoji) => [emoji.id, emoji]));

    let channelCommunityId: string | null | undefined;

    for (const customEmojiId of customEmojiIds) {
      const customEmoji = customEmojiById.get(customEmojiId);
      if (!customEmoji) {
        throw new BadRequestException('Message contains invalid or deleted custom emoji');
      }

      if (customEmoji.scopeType === 'GLOBAL') {
        continue;
      }

      if (customEmoji.scopeType === 'USER') {
        if (customEmoji.scopeId === senderUserId) {
          continue;
        }

        throw new ForbiddenException('Message contains custom emoji you are not allowed to use');
      }

      channelCommunityId = await this.getChannelCommunityId(channelId, channelCommunityId);

      if (customEmoji.scopeId !== channelCommunityId) {
        throw new ForbiddenException('Message contains custom emoji you are not allowed to use');
      }
    }
  }

  async setMessageReaction(args: {
    channelId: string;
    messageId: string;
    userId: string;
    reactorDisplayName: string;
    emojiKind: ReactionEmojiKind;
    emojiValue: string;
    active: boolean;
  }): Promise<MessageReactionAggregateDto[]> {
    const channelId = args.channelId.trim();
    const messageId = args.messageId.trim();
    const userId = args.userId.trim();
    const reactorDisplayName = args.reactorDisplayName.trim();
    const emojiValue = args.emojiValue.trim();

    if (!channelId) {
      throw new BadRequestException('channelId is required');
    }

    if (!messageId) {
      throw new BadRequestException('messageId is required');
    }

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!reactorDisplayName) {
      throw new BadRequestException('reactorDisplayName is required');
    }

    if (!emojiValue) {
      throw new BadRequestException('emojiValue is required');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.channelId !== channelId) {
      throw new BadRequestException('messageId does not belong to channelId');
    }

    await this.assertCanViewChannel(channelId, userId);

    if (args.emojiKind === 'CUSTOM') {
      await this.assertCanUseCustomEmojiId(channelId, userId, emojiValue);
    }

    if (args.active) {
      await this.prisma.messageReaction.upsert({
        where: {
          messageId_userId_emojiKind_emojiValue: {
            messageId,
            userId,
            emojiKind: args.emojiKind,
            emojiValue,
          },
        },
        update: {
          reactorDisplayName,
        },
        create: {
          messageId,
          userId,
          reactorDisplayName,
          emojiKind: args.emojiKind,
          emojiValue,
        },
      });
    } else {
      await this.prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId,
          emojiKind: args.emojiKind,
          emojiValue,
        },
      });
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: {
        emojiKind: true,
        emojiValue: true,
        userId: true,
        reactorDisplayName: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return this.summarizeReactionAggregates(reactions);
  }

  private extractCustomEmojiIds(body: string): string[] {
    const ids = new Set<string>();
    CUSTOM_EMOJI_TOKEN_REGEX.lastIndex = 0;
    let match = CUSTOM_EMOJI_TOKEN_REGEX.exec(body);

    while (match) {
      ids.add(match[2]);
      match = CUSTOM_EMOJI_TOKEN_REGEX.exec(body);
    }

    return Array.from(ids);
  }

  private async assertCanUseCustomEmojiId(channelId: string, senderUserId: string, customEmojiId: string): Promise<void> {
    const customEmoji = await this.prisma.customEmoji.findUnique({
      where: { id: customEmojiId },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        deletedAt: true,
      },
    });

    if (!customEmoji || customEmoji.deletedAt) {
      throw new BadRequestException('Message contains invalid or deleted custom emoji');
    }

    if (customEmoji.scopeType === 'GLOBAL') {
      return;
    }

    if (customEmoji.scopeType === 'USER') {
      if (customEmoji.scopeId === senderUserId) {
        return;
      }

      throw new ForbiddenException('Message contains custom emoji you are not allowed to use');
    }

    const channelCommunityId = await this.getChannelCommunityId(channelId, undefined);
    if (customEmoji.scopeId !== channelCommunityId) {
      throw new ForbiddenException('Message contains custom emoji you are not allowed to use');
    }
  }

  private async getChannelCommunityId(
    channelId: string,
    currentValue: string | null | undefined,
  ): Promise<string | null> {
    if (currentValue !== undefined) {
      return currentValue;
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel.communityId;
  }

  issueConnectionToken(userId: string): ChatTokenResponse {
    const secret = process.env.CHAT_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('CHAT_TOKEN_SECRET is not configured');
    }

    const token = jwt.sign({ sub: userId, ver: 1 }, secret, {
      algorithm: 'HS256',
      expiresIn: CHAT_TOKEN_TTL_SECONDS,
      audience: 'chat',
      issuer: 'cup-api',
    });

    return {
      token,
      expiresInSeconds: CHAT_TOKEN_TTL_SECONDS,
    };
  }

  async getChannelHistory(
    channelId: string,
    userId: string | undefined,
    query: ChannelHistoryQueryParsed,
  ): Promise<ChannelHistoryResponseDto> {
    await this.assertCanViewChannel(channelId, userId);
    const where: Prisma.MessageWhereInput = {
      channelId,
    };

    if (query.beforeCreatedAt && query.beforeId) {
      //if we have beforeCreatedAt and beforeId(parsing ensures that we either have both or neither)
      where.OR = [
        { createdAt: { lt: query.beforeCreatedAt } }, //either createdAt is before query.createdAt
        {
          // OR createdAt EQUALS query.createdAt, and id is before query.id(basically, if 2 records have same createdAt, then use Id to determine order)
          AND: [{ createdAt: query.beforeCreatedAt }, { id: { lt: query.beforeId } }],
        },
      ];
    }

    const rows = await this.prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1, //grab an extra row to see if more records exist, used to set 'hasMore' below
      select: {
        id: true,
        channelId: true,
        authorUserId: true,
        author: {
          select: {
            displayName: true,
            username: true,
          },
        },
        replyMessageId: true,
        body: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        reactions: {
          select: {
            emojiKind: true,
            emojiValue: true,
            userId: true,
            reactorDisplayName: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const hasMore = rows.length > query.limit; //if we got that 1 extra row then we know there are more records
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? {
            beforeCreatedAt: last.createdAt.toISOString(),
            beforeId: last.id,
          }
        : null;

    return {
      messages: pageRows.map((row) => ({
        id: row.id,
        channelId: row.channelId,
        authorUserId: row.authorUserId,
        authorDisplayName: row.author.displayName ?? row.author.username,
        replyMessageId: row.replyMessageId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
        reactions: this.summarizeReactions(row.reactions, userId),
      })),
      nextCursor,
    };
  }

  async assertCanViewChannel(channelId: string, viewerUserId?: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, visibility: true },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.visibility === 'PUBLIC') {
      return;
    }
    if (!viewerUserId) {
      throw new ForbiddenException('You do not have access to this channel');
    }
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: viewerUserId,
        },
      },
      select: { channelId: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }

  parseChannelHistoryQuery(query: ChannelHistoryQueryRaw): ChannelHistoryQueryParsed {
    const limitRaw = query.limit?.trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_MSG_LIMIT;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MSG_LIMIT)
      throw new BadRequestException(`limit must be an integer between 1 and ${MAX_MSG_LIMIT}`);

    const beforeCreatedAtRaw = query.beforeCreatedAt?.trim();
    const beforeIdRaw = query.beforeId?.trim();

    if (!!beforeCreatedAtRaw !== !!beforeIdRaw) {
      throw new BadRequestException('beforeCreatedAt and beforeId must both be provided(or neither)');
    }

    if (!beforeCreatedAtRaw || !beforeIdRaw) {
      return { limit };
    }

    const beforeCreatedAt = new Date(beforeCreatedAtRaw);
    if (Number.isNaN(beforeCreatedAt.getTime())) {
      throw new BadRequestException('beforeCreatedAt must be a valid ISO timestamp');
    }

    return {
      limit,
      beforeCreatedAt,
      beforeId: beforeIdRaw,
    };
  }

  async resolveAuthorDisplayName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        username: true,
      },
    });
    if (!user) {
      return null;
    }
    return user.displayName ?? user.username;
  }

  //returns display info needed by frontend to render reactions for a single message
  private summarizeReactions(
    reactions: Array<{
      emojiKind: 'UNICODE' | 'CUSTOM';
      emojiValue: string;
      userId: string;
      reactorDisplayName: string;
    }>,
    viewerUserId: string | undefined,
  ): MessageReactionSummaryDto[] {
    const byEmoji = new Map<
      string,
      {
        emojiKind: 'UNICODE' | 'CUSTOM';
        emojiValue: string;
        count: number;
        reactedByMe: boolean;
        reactorDisplayNames: string[];
      }
    >();

    for (const reaction of reactions) {
      const key = `${reaction.emojiKind}:${reaction.emojiValue}`;
      const existing = byEmoji.get(key);

      if (existing) {
        existing.count += 1;
        if (viewerUserId && reaction.userId === viewerUserId) {
          existing.reactedByMe = true;
        }
        if (existing.reactorDisplayNames.length < 3) {
          existing.reactorDisplayNames.push(reaction.reactorDisplayName);
        }
        continue;
      }

      byEmoji.set(key, {
        emojiKind: reaction.emojiKind,
        emojiValue: reaction.emojiValue,
        count: 1,
        reactedByMe: viewerUserId ? reaction.userId === viewerUserId : false,
        reactorDisplayNames: [reaction.reactorDisplayName],
      });
    }

    return Array.from(byEmoji.values());
  }

  private summarizeReactionAggregates(
    reactions: Array<{
      emojiKind: 'UNICODE' | 'CUSTOM';
      emojiValue: string;
      userId: string;
      reactorDisplayName: string;
    }>,
  ): MessageReactionAggregateDto[] {
    const byEmoji = new Map<
      string,
      {
        emojiKind: 'UNICODE' | 'CUSTOM';
        emojiValue: string;
        count: number;
        reactorDisplayNames: string[];
      }
    >();

    for (const reaction of reactions) {
      const key = `${reaction.emojiKind}:${reaction.emojiValue}`;
      const existing = byEmoji.get(key);

      if (existing) {
        existing.count += 1;
        if (existing.reactorDisplayNames.length < 3) {
          existing.reactorDisplayNames.push(reaction.reactorDisplayName);
        }
        continue;
      }

      byEmoji.set(key, {
        emojiKind: reaction.emojiKind,
        emojiValue: reaction.emojiValue,
        count: 1,
        reactorDisplayNames: [reaction.reactorDisplayName],
      });
    }

    return Array.from(byEmoji.values());
  }

  async createMessage(args: { channelId: string; authorUserId: string; body: string; replyMessageId?: string | null }) {
    const channelId = args.channelId.trim();
    const authorUserId = args.authorUserId.trim();
    const body = args.body.trim();
    const replyMessageId = args.replyMessageId?.trim() || null;
    if (!channelId) {
      throw new BadRequestException('channelId is required');
    }
    if (!authorUserId) {
      throw new BadRequestException('authorUserId is required');
    }
    if (!body) {
      throw new BadRequestException('Message body is required');
    }

    if (replyMessageId) {
      const replyTarget = await this.prisma.message.findUnique({
        where: { id: replyMessageId },
        select: {
          id: true,
          channelId: true,
        },
      });

      if (!replyTarget) {
        throw new BadRequestException('replyMessageId must reference an existing message');
      }

      if (replyTarget.channelId !== channelId) {
        throw new BadRequestException('replyMessageId must reference a message in the same channel');
      }
    }

    return this.prisma.message.create({
      data: {
        channelId,
        authorUserId,
        replyMessageId,
        body,
      },
      select: {
        id: true,
        channelId: true,
        authorUserId: true,
        replyMessageId: true,
        body: true,
        createdAt: true,
      },
    });
  }
}
